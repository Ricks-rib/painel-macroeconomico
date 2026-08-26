import type { SeriesPoint } from '@bcb/shared';
import { env } from '../config/env.js';
import { bcbDateToIso, splitIntoWindows, toBcbDate, type DateWindow } from './dates.js';
import { logger } from './logger.js';

/**
 * Cliente da API de series temporais do Banco Central (SGS).
 *
 * ---------------------------------------------------------------------------
 * O QUE A API FAZ DE INESPERADO
 * ---------------------------------------------------------------------------
 * Tudo abaixo foi medido contra a API real, nao lido em documentacao. Cada
 * item ja quebrou (ou quebraria) uma implementacao ingenua:
 *
 * 1. `/dados/ultimos/{N}` recusa N > 20 com HTTP 400 e a mensagem
 *    "A quantidade maxima de valores deve ser 20". Nao ha paginacao: para
 *    historico, o unico caminho e o endpoint de intervalo.
 *
 * 2. `/dados?dataInicial&dataFinal` recusa intervalos longos com HTTP 406.
 *    Medido: 2017-2026 responde 200 com 2.420 pontos; 2016-2026 responde 406.
 *    Por isso o backfill vai fatiado em janelas (ver `splitIntoWindows`).
 *
 * 3. Intervalo sem dados responde HTTP **404**, nao lista vazia. Tratar isso
 *    como falha faria uma serie ainda nao publicada derrubar a sincronizacao
 *    inteira -- aqui vira lista vazia, que e o que de fato significa.
 *
 * 4. Codigo de serie inexistente devolve uma **pagina HTML**, nao JSON. Um
 *    `JSON.parse` direto lanca SyntaxError com mensagem sem relacao com a causa
 *    real. Por isso o content-type e conferido antes.
 *
 * 5. O separador decimal muda com o formato: JSON usa ponto ("5.1862"), CSV usa
 *    virgula ("4,74"). Usamos JSON, mas o parse aceita os dois -- custa nada e
 *    protege de uma mudanca silenciosa.
 */

/** Teto imposto pela API em `/dados/ultimos/{N}`. */
export const MAX_LATEST_POINTS = 20;

export class BcbApiError extends Error {
  constructor(
    readonly codigo: number,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BcbApiError';
  }
}

/**
 * Backfill pede anos de serie diaria de uma vez e o SGS demora bem mais que
 * numa consulta de rotina -- medido: as quatro series diarias de 10 anos
 * estouraram um limite de 15s enquanto as mensais respondiam em segundos.
 * Como e uma operacao rara (uma vez por serie, na primeira carga), vale
 * esperar; a consulta incremental do dia a dia continua com o limite curto.
 */
const RANGE_TIMEOUT_MS = 90_000;

async function requestJson(codigo: number, url: string, timeoutMs: number): Promise<unknown[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    // Intervalo sem dados publicados. Nao e erro: e ausencia de dado.
    if (response.status === 404) {
      logger.debug('serie sem dados no intervalo', { codigo });
      return [];
    }

    if (!response.ok) {
      const detail = await extractErrorDetail(response);
      throw new BcbApiError(
        codigo,
        `SGS respondeu ${response.status} para a serie ${codigo}. ${detail}`,
        response.status,
      );
    }

    // Codigo inexistente devolve HTML com status 200 em alguns casos.
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new BcbApiError(
        codigo,
        `SGS devolveu "${contentType || 'sem content-type'}" em vez de JSON para a serie ${codigo}. O codigo existe?`,
        response.status,
      );
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      throw new BcbApiError(codigo, `Resposta inesperada do SGS para a serie ${codigo}.`);
    }

    return payload;
  } catch (error) {
    if (error instanceof BcbApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BcbApiError(
        codigo,
        `O SGS nao respondeu em ${timeoutMs / 1000}s para a serie ${codigo}.`,
      );
    }

    throw new BcbApiError(
      codigo,
      `Falha de rede ao consultar a serie ${codigo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** A API embute a causa util em `erro.detail`, atras de um nome de classe Java. */
async function extractErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { erro?: { detail?: string } };
    const detail = body.erro?.detail ?? '';
    return detail.replace(/^.*SGSNegocioException:\s*/, '').trim();
  } catch {
    return '';
  }
}

/** Converte a linha crua do SGS num ponto normalizado, descartando o que nao der. */
function parsePoints(codigo: number, raw: unknown[]): SeriesPoint[] {
  const points: SeriesPoint[] = [];

  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue;
    const { data, valor } = row as { data?: unknown; valor?: unknown };
    if (typeof data !== 'string' || typeof valor !== 'string') continue;

    const iso = bcbDateToIso(data);
    if (!iso) continue;

    const parsed = Number(valor.replace(',', '.'));
    if (!Number.isFinite(parsed)) continue;

    points.push({ data: iso, valor: parsed });
  }

  if (points.length < raw.length) {
    logger.debug('pontos descartados no parse', { codigo, recebidos: raw.length, validos: points.length });
  }

  return points;
}

/** Ordena por data e remove repeticoes, mantendo a ultima ocorrencia. */
function normalize(points: SeriesPoint[]): SeriesPoint[] {
  const byDate = new Map<string, SeriesPoint>();
  for (const point of points) byDate.set(point.data, point);
  return [...byDate.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Ultimos N pontos da serie. Barato: uma requisicao, sem parametro de data.
 * Usado na revalidacao de rotina, quando so interessa o que mudou no fim.
 */
export async function fetchLatest(codigo: number, n: number): Promise<SeriesPoint[]> {
  const limit = Math.min(Math.max(1, n), MAX_LATEST_POINTS);
  const url = `${env.BCB_API_BASE_URL}/bcdata.sgs.${codigo}/dados/ultimos/${limit}?formato=json`;
  return normalize(
    parsePoints(codigo, await requestJson(codigo, url, env.BCB_REQUEST_TIMEOUT_MS)),
  );
}

/**
 * Historico completo de um intervalo, fatiado em janelas aceitas pela API.
 *
 * As janelas sao percorridas em sequencia, nao em paralelo: sao poucas por
 * serie, e disparar tudo de uma vez contra um servico publico e gratuito e a
 * forma mais rapida de ser bloqueado por ele.
 */
export async function fetchRange(codigo: number, start: Date, end: Date): Promise<SeriesPoint[]> {
  const windows: DateWindow[] = splitIntoWindows(start, end);
  const collected: SeriesPoint[] = [];

  for (const window of windows) {
    const url =
      `${env.BCB_API_BASE_URL}/bcdata.sgs.${codigo}/dados?formato=json` +
      `&dataInicial=${toBcbDate(window.start)}&dataFinal=${toBcbDate(window.end)}`;

    collected.push(...parsePoints(codigo, await requestJson(codigo, url, RANGE_TIMEOUT_MS)));
  }

  return normalize(collected);
}
