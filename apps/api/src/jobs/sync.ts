import {
  VERIFIED_SERIES,
  type SeriesDefinition,
  type SeriesPoint,
  type SyncStatus,
} from '@bcb/shared';
import { prisma } from '../db/client.js';
import { BcbApiError, fetchLatest, fetchRange, MAX_LATEST_POINTS } from '../lib/bcb-client.js';
import { yearsAgo } from '../lib/dates.js';
import { logger } from '../lib/logger.js';

/**
 * Sincronizacao com o SGS.
 *
 * Este e o unico ponto do sistema que fala com a rede externa. Tudo o mais le
 * do SQLite -- e essa e a decisao central do modulo: a fonte e publica,
 * gratuita e fora do nosso controle, entao o painel nao pode depender dela
 * estar de pe no instante em que alguem abre a tela.
 *
 * DUAS ESTRATEGIAS, escolhidas por serie conforme o que ja existe em base:
 *
 *   backfill    -- serie ainda sem pontos. Busca anos de historico pelo
 *                  endpoint de intervalo, fatiado em janelas (o SGS recusa
 *                  faixas longas com 406).
 *   incremental -- serie ja povoada. Busca so os ultimos pontos. E aqui que o
 *                  teto de 20 do endpoint `/ultimos/{N}` deixa de ser
 *                  limitacao: para revalidar a ponta da serie, 20 pontos
 *                  sobram, e ainda pega revisao retroativa recente.
 *
 * Falha de uma serie nao contamina as outras: cada uma entra em `ok` ou em
 * `failed` com o motivo, e a execucao termina como PARTIAL. Um indicador fora
 * do ar nao pode apagar o painel inteiro.
 */

/** Quantos pontos revalidar numa sincronizacao incremental. */
const INCREMENTAL_POINTS = MAX_LATEST_POINTS;

/** Lote de escrita: mantem a lista de parametros do SQLite dentro do limite. */
const WRITE_CHUNK = 400;

export interface SeriesSyncResult {
  codigo: number;
  nome: string;
  mode: 'backfill' | 'incremental';
  pointsWritten: number;
}

export interface SyncRunResult {
  id: string;
  status: SyncStatus;
  ok: SeriesSyncResult[];
  failed: Array<{ codigo: number; nome: string; error: string }>;
  pointsWritten: number;
  durationMs: number;
}

/**
 * Trava de execucao unica.
 *
 * Tres gatilhos disparam sincronizacao (boot, intervalo e botao manual) e a
 * revalidacao sob demanda pode disparar um quarto. Sem esta trava, abrir o
 * painel logo apos subir o servidor renderia varias rodadas simultaneas contra
 * um servico publico, escrevendo os mesmos pontos.
 */
let inFlight: Promise<SyncRunResult> | null = null;

export function isSyncRunning(): boolean {
  return inFlight !== null;
}

/** Sincroniza todas as series verificadas. Chamadas concorrentes compartilham a mesma execucao. */
export function syncAll(): Promise<SyncRunResult> {
  if (inFlight) {
    logger.debug('sync ja em andamento; reaproveitando execucao');
    return inFlight;
  }

  inFlight = runSync([...VERIFIED_SERIES]).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Sincroniza um subconjunto -- usado pela revalidacao sob demanda. */
export async function syncSeriesSubset(definitions: SeriesDefinition[]): Promise<SyncRunResult> {
  if (definitions.length === 0) {
    return emptyResult();
  }
  if (inFlight) return inFlight;

  inFlight = runSync(definitions).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

async function runSync(definitions: SeriesDefinition[]): Promise<SyncRunResult> {
  const id = `sync_${Date.now()}`;
  const startedAt = new Date();

  await prisma.syncRun.create({
    data: {
      id,
      startedAt,
      status: 'RUNNING' satisfies SyncStatus,
      seriesCodes: JSON.stringify(definitions.map((d) => d.codigo)),
      seriesOk: '[]',
      seriesFailed: '[]',
    },
  });

  const ok: SeriesSyncResult[] = [];
  const failed: Array<{ codigo: number; nome: string; error: string }> = [];

  for (const definition of definitions) {
    try {
      ok.push(await syncOne(definition));
    } catch (error) {
      const message =
        error instanceof BcbApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);

      logger.warn('falha ao sincronizar serie', { codigo: definition.codigo, error: message });
      failed.push({ codigo: definition.codigo, nome: definition.nome, error: message });
    }
  }

  const durationMs = Date.now() - startedAt.getTime();
  const pointsWritten = ok.reduce((total, item) => total + item.pointsWritten, 0);
  const status: SyncStatus =
    failed.length === 0 ? 'SUCCESS' : ok.length === 0 ? 'FAILED' : 'PARTIAL';

  await prisma.syncRun.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      status,
      seriesOk: JSON.stringify(ok.map((item) => item.codigo)),
      seriesFailed: JSON.stringify(failed),
      pointsWritten,
      durationMs,
    },
  });

  logger.info('sincronizacao concluida', {
    status,
    series: `${ok.length}/${definitions.length}`,
    pontos: pointsWritten,
    ms: durationMs,
  });

  return { id, status, ok, failed, pointsWritten, durationMs };
}

async function syncOne(definition: SeriesDefinition): Promise<SeriesSyncResult> {
  const existing = await prisma.seriesPoint.count({ where: { codigo: definition.codigo } });
  const mode: 'backfill' | 'incremental' = existing === 0 ? 'backfill' : 'incremental';

  const points =
    mode === 'backfill'
      ? await fetchRange(definition.codigo, yearsAgo(definition.historyYears), new Date())
      : await fetchLatest(definition.codigo, INCREMENTAL_POINTS);

  const written = await writePoints(definition.codigo, points);

  logger.debug('serie sincronizada', {
    codigo: definition.codigo,
    nome: definition.nome,
    mode,
    pontos: written,
  });

  return { codigo: definition.codigo, nome: definition.nome, mode, pointsWritten: written };
}

/**
 * Grava os pontos de forma idempotente.
 *
 * Apaga e reescreve exatamente as datas recebidas, em transacao. Nao e so
 * insercao porque o BCB revisa valores publicados -- um ponto que ja existe
 * pode ter mudado, e `skipDuplicates` manteria o valor velho para sempre.
 */
async function writePoints(codigo: number, points: SeriesPoint[]): Promise<number> {
  if (points.length === 0) return 0;

  const syncedAt = new Date();

  for (let index = 0; index < points.length; index += WRITE_CHUNK) {
    const chunk = points.slice(index, index + WRITE_CHUNK);

    await prisma.$transaction([
      prisma.seriesPoint.deleteMany({
        where: { codigo, data: { in: chunk.map((point) => point.data) } },
      }),
      prisma.seriesPoint.createMany({
        data: chunk.map((point) => ({
          codigo,
          data: point.data,
          valor: point.valor,
          syncedAt,
        })),
      }),
    ]);
  }

  return points.length;
}

function emptyResult(): SyncRunResult {
  return {
    id: 'noop',
    status: 'SUCCESS',
    ok: [],
    failed: [],
    pointsWritten: 0,
    durationMs: 0,
  };
}

// ---------------------------------------------------------------------------
// Agendamento
// ---------------------------------------------------------------------------

let timer: NodeJS.Timeout | null = null;

/**
 * Liga o sincronizador periodico.
 *
 * `setInterval` em vez de cron: e uma dependencia a menos para um agendamento
 * que nao precisa de expressao de calendario. Se o job passar a precisar de
 * janela de execucao ou de varios processos, ai sim entra uma fila.
 */
export function startScheduler(intervalMinutes: number): void {
  if (timer) return;

  timer = setInterval(
    () => {
      syncAll().catch((error: unknown) => {
        logger.error('sincronizacao periodica falhou', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    },
    intervalMinutes * 60_000,
  );

  // Nao segura o processo vivo so por causa do timer.
  timer.unref();
  logger.info('sincronizacao periodica agendada', { minutos: intervalMinutes });
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
