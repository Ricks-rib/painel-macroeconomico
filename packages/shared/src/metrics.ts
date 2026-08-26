import type { CompareAs, SeriesPoint } from './domain.js';

/**
 * Toda conta do projeto mora aqui.
 *
 * A API, o resumo automatico e as ferramentas do assistente importam destas
 * funcoes; o frontend apenas formata o que recebe. E o que evita o modo de
 * falha classico de painel -- a mesma metrica com dois valores em duas telas --
 * e, no caso da IA, garante que o numero que o modelo verbaliza saiu do mesmo
 * calculo que pintou o grafico.
 */

/** Ultimo ponto da serie (assume ordenacao crescente por data). */
export function latestPoint(points: readonly SeriesPoint[]): SeriesPoint | null {
  return points.length > 0 ? (points[points.length - 1] as SeriesPoint) : null;
}

/** Penultimo ponto -- a base de comparacao padrao de um indicador. */
export function previousPoint(points: readonly SeriesPoint[]): SeriesPoint | null {
  return points.length > 1 ? (points[points.length - 2] as SeriesPoint) : null;
}

export interface SeriesChange {
  /** Diferenca bruta `depois - antes`. Sempre definida. */
  absolute: number;
  /**
   * Variacao relativa em percentual. `null` quando a base e zero -- divisao
   * por zero nao vira Infinity mascarado de indicador.
   */
  relative: number | null;
  /**
   * A leitura que deve ser exibida, escolhida pela semantica da serie:
   * pontos percentuais para series que ja sao percentuais, variacao relativa
   * para series de nivel. Calculada aqui, uma vez, para que grafico, card e
   * assistente nao possam divergir.
   */
  primary: number | null;
  primaryUnit: 'PP' | 'PCT';
}

export function computeChange(from: number, to: number, compareAs: CompareAs): SeriesChange {
  const absolute = to - from;
  const relative = from === 0 ? null : (absolute / Math.abs(from)) * 100;
  const usesPp = compareAs === 'ABSOLUTE_PP';

  return {
    absolute,
    relative,
    primary: usesPp ? absolute : relative,
    primaryUnit: usesPp ? 'PP' : 'PCT',
  };
}

/** Variacao entre os dois ultimos pontos. `null` se nao ha base de comparacao. */
export function changeFromPrevious(
  points: readonly SeriesPoint[],
  compareAs: CompareAs,
): SeriesChange | null {
  const current = latestPoint(points);
  const previous = previousPoint(points);
  if (!current || !previous) return null;
  return computeChange(previous.valor, current.valor, compareAs);
}

/** Variacao entre o primeiro e o ultimo ponto de uma janela ja recortada. */
export function changeOverWindow(
  points: readonly SeriesPoint[],
  compareAs: CompareAs,
): SeriesChange | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) return null;
  return computeChange(first.valor, last.valor, compareAs);
}

/**
 * Recorta os pontos dos ultimos N dias corridos a partir do ponto mais recente
 * da serie -- nao a partir de hoje. Uma serie mensal publicada com defasagem
 * ficaria vazia se a janela fosse ancorada na data atual.
 */
export function sliceLastDays(points: readonly SeriesPoint[], days: number): SeriesPoint[] {
  const last = latestPoint(points);
  if (!last) return [];

  const cutoff = new Date(`${last.data}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  return points.filter((p) => p.data >= cutoffIso);
}

/** Media movel simples. Pontos antes de completar a janela saem como `null`. */
export function movingAverage(
  points: readonly SeriesPoint[],
  window: number,
): Array<{ data: string; valor: number | null }> {
  if (window < 1) throw new Error('window deve ser >= 1');

  let sum = 0;
  return points.map((point, index) => {
    sum += point.valor;
    if (index >= window) {
      const leaving = points[index - window];
      if (leaving) sum -= leaving.valor;
    }
    return {
      data: point.data,
      valor: index >= window - 1 ? sum / window : null,
    };
  });
}

export interface SeriesExtremes {
  min: SeriesPoint;
  max: SeriesPoint;
}

export function extremes(points: readonly SeriesPoint[]): SeriesExtremes | null {
  const first = points[0];
  if (!first) return null;

  let min = first;
  let max = first;
  for (const point of points) {
    if (point.valor < min.valor) min = point;
    if (point.valor > max.valor) max = point;
  }
  return { min, max };
}

export function average(points: readonly SeriesPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((acc, p) => acc + p.valor, 0) / points.length;
}
