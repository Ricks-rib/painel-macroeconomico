import {
  CATEGORY_LABELS,
  SERIES_CATALOG,
  VERIFIED_SERIES,
  changeFromPrevious,
  changeOverWindow,
  findSeriesBySlug,
  HEADLINE_SLUGS,
  latestPoint,
  seriesByCategory,
  sliceLastDays,
  type CatalogResponse,
  type CategoryResponse,
  type OverviewResponse,
  type SeriesCategory,
  type SeriesDefinition,
  type SeriesDetail,
  type SeriesMeta,
  type SeriesPoint,
  type SeriesSummary,
} from '@bcb/shared';
import { env } from '../../config/env.js';
import { AppError } from '../../http/errors.js';
import { syncSeriesSubset } from '../../jobs/sync.js';
import { minutesSince } from '../../lib/dates.js';
import { logger } from '../../lib/logger.js';
import { getSyncStatus } from '../sync/sync.service.js';
import { getFreshness, getLastPoints, getPoints, type SeriesFreshness } from './series.repo.js';

/** Pontos do sparkline no card de indicador. */
const SPARKLINE_POINTS = 24;

const SGS_PUBLIC_URL = 'https://www3.bcb.gov.br/sgspub';

function toMeta(definition: SeriesDefinition): SeriesMeta {
  return {
    codigo: definition.codigo,
    slug: definition.slug,
    nome: definition.nome,
    descricao: definition.descricao,
    unidade: definition.unidade,
    categoria: definition.categoria,
    frequencia: definition.frequencia,
    casasDecimais: definition.casasDecimais,
    betterWhen: definition.betterWhen,
    compareAs: definition.compareAs,
  };
}

/**
 * Revalidacao sob demanda.
 *
 * O agendador cobre o caso normal, mas nao o caso de ninguem abrir o painel
 * por dias: ao voltar, a primeira tela mostraria dado velho ate a proxima volta
 * do intervalo. Aqui a leitura verifica a idade antes de responder e, se
 * passou do limite da frequencia daquela serie, sincroniza antes.
 *
 * O limite e por frequencia porque revalidar de hora em hora uma serie que o
 * BCB publica uma vez por mes so gasta requisicao contra um servico gratuito.
 */
async function ensureFresh(definitions: readonly SeriesDefinition[]): Promise<void> {
  const freshness = await getFreshness(definitions.map((d) => d.codigo));

  const stale = definitions.filter((definition) => {
    const entry = freshness.get(definition.codigo);
    if (!entry?.syncedAt) return true;

    const limit =
      definition.frequencia === 'DIARIA'
        ? env.SYNC_STALE_MINUTES_DIARIA
        : env.SYNC_STALE_MINUTES_MENSAL;

    return minutesSince(entry.syncedAt) > limit;
  });

  if (stale.length === 0) return;

  logger.debug('revalidando series vencidas', { codigos: stale.map((s) => s.codigo) });

  try {
    await syncSeriesSubset(stale);
  } catch (error) {
    // A fonte externa estar fora nao pode derrubar a leitura: seguimos com o
    // ultimo dado conhecido, e o cabecalho de sincronizacao mostra a idade.
    logger.warn('revalidacao falhou; servindo dado em cache', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function buildSummary(
  definition: SeriesDefinition,
  points: SeriesPoint[],
  freshness: SeriesFreshness | undefined,
): SeriesSummary {
  return {
    meta: toMeta(definition),
    latest: latestPoint(points),
    change: changeFromPrevious(points, definition.compareAs),
    sparkline: points,
    syncedAt: freshness?.syncedAt?.toISOString() ?? null,
  };
}

function buildDetail(
  definition: SeriesDefinition,
  points: SeriesPoint[],
  freshness: SeriesFreshness | undefined,
  periodDays: number | null,
): SeriesDetail {
  return {
    meta: toMeta(definition),
    points,
    latest: latestPoint(points),
    windowChange: changeOverWindow(points, definition.compareAs),
    change: changeFromPrevious(points, definition.compareAs),
    syncedAt: freshness?.syncedAt?.toISOString() ?? null,
    periodDays,
  };
}

/** Visao geral: os indicadores de abertura mais um resumo por categoria. */
export async function getOverview(): Promise<OverviewResponse> {
  await ensureFresh(VERIFIED_SERIES);

  const freshness = await getFreshness(VERIFIED_SERIES.map((s) => s.codigo));

  const summaries = new Map<string, SeriesSummary>();
  for (const definition of VERIFIED_SERIES) {
    const points = await getLastPoints(definition.codigo, SPARKLINE_POINTS);
    summaries.set(definition.slug, buildSummary(definition, points, freshness.get(definition.codigo)));
  }

  const headline = HEADLINE_SLUGS.map((slug) => summaries.get(slug)).filter(
    (item): item is SeriesSummary => item !== undefined,
  );

  const categories = (Object.keys(CATEGORY_LABELS) as SeriesCategory[]).map((categoria) => ({
    categoria,
    series: seriesByCategory(categoria)
      .map((definition) => summaries.get(definition.slug))
      .filter((item): item is SeriesSummary => item !== undefined),
  }));

  return { headline, categories, sync: await getSyncStatus() };
}

/** Todas as series de uma categoria, com historico recortado pela janela. */
export async function getCategory(
  categoria: SeriesCategory,
  days: number,
): Promise<CategoryResponse> {
  const definitions = seriesByCategory(categoria);
  if (definitions.length === 0) {
    throw AppError.notFound('Categoria', categoria);
  }

  await ensureFresh(definitions);
  const freshness = await getFreshness(definitions.map((d) => d.codigo));

  const series: SeriesDetail[] = [];
  for (const definition of definitions) {
    const all = await getPoints(definition.codigo);
    const windowed = sliceLastDays(all, days);
    series.push(buildDetail(definition, windowed, freshness.get(definition.codigo), days));
  }

  return { categoria, series, sync: await getSyncStatus() };
}

/** Uma serie especifica, identificada pelo slug. */
export async function getSeriesBySlug(slug: string, days: number): Promise<SeriesDetail> {
  const definition = findSeriesBySlug(slug);
  if (!definition) {
    throw AppError.notFound('Serie', slug);
  }

  await ensureFresh([definition]);

  const [all, freshness] = await Promise.all([
    getPoints(definition.codigo),
    getFreshness([definition.codigo]),
  ]);

  const windowed = sliceLastDays(all, days);
  return buildDetail(definition, windowed, freshness.get(definition.codigo), days);
}

/**
 * Catalogo para auditoria, na tela de Configuracoes.
 *
 * Inclui as series NAO verificadas -- e o unico lugar onde elas aparecem. A
 * intencao e o oposto de esconder: quem usa o painel consegue ver quais
 * codigos foram conferidos, quando, e com que evidencia, e conferir por conta
 * propria no SGS.
 */
export async function getCatalog(): Promise<CatalogResponse> {
  const freshness = await getFreshness(SERIES_CATALOG.map((s) => s.codigo));

  return {
    sgsUrl: SGS_PUBLIC_URL,
    entries: SERIES_CATALOG.map((definition) => {
      const entry = freshness.get(definition.codigo);
      return {
        codigo: definition.codigo,
        slug: definition.slug,
        nome: definition.nome,
        categoria: definition.categoria,
        unidade: definition.unidade,
        verified: definition.verified,
        verifiedAt: definition.verifiedAt ?? null,
        notes: definition.notes ?? null,
        pointCount: entry?.pointCount ?? 0,
        latestData: entry?.latestData ?? null,
        syncedAt: entry?.syncedAt?.toISOString() ?? null,
      };
    }),
  };
}
