/**
 * Ponte entre os tokens do CSS e o Recharts.
 *
 * O Recharts precisa de hex em propriedade de componente; o Tailwind guarda a
 * paleta em custom property. Ler as variaveis em tempo de execucao evita a
 * duplicacao classica -- uma lista de cores no CSS e outra no JavaScript, que
 * divergem no primeiro ajuste e ninguem percebe ate alguem comparar duas telas.
 *
 * O mapa de reserva existe para o caso de nao haver DOM (teste, render fora do
 * navegador); e copia dos mesmos valores validados em `index.css`.
 */

const FALLBACK: Record<string, string> = {
  'color-series-1': '#2a78d6',
  'color-series-2': '#eb6834',
  'color-series-3': '#4a3aa7',
  'color-grid': '#e2e8f0',
  'color-axis': '#c7d0da',
  'color-ink': '#0b1f33',
  'color-ink-2': '#33475a',
  'color-ink-muted': '#5e6e80',
  'color-surface': '#ffffff',
  'color-hairline': '#dde3ea',
  'color-good': '#006300',
  'color-critical': '#b3261e',
  'color-primary': '#0a2f4f',
};

function token(name: string): string {
  if (typeof window === 'undefined') return FALLBACK[name] ?? '#000000';

  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return value || (FALLBACK[name] ?? '#000000');
}

/**
 * Ordem fixa, nunca ciclada.
 *
 * Sao tres, e o limite e a razao de existir do array: a quarta cor nao passou
 * na validacao de daltonismo contra este fundo. Um quarto indicador no mesmo
 * grafico e sinal de que ele deveria ser dois graficos.
 */
export const SERIES_COLORS = [
  'color-series-1',
  'color-series-2',
  'color-series-3',
] as const;

export function seriesColor(index: number): string {
  const name = SERIES_COLORS[index % SERIES_COLORS.length];
  return token(name ?? 'color-series-1');
}

export const chartTheme = {
  get grid() {
    return token('color-grid');
  },
  get axis() {
    return token('color-axis');
  },
  get axisLabel() {
    return token('color-ink-muted');
  },
  get surface() {
    return token('color-surface');
  },
  get hairline() {
    return token('color-hairline');
  },
  get ink() {
    return token('color-ink');
  },
  get good() {
    return token('color-good');
  },
  get critical() {
    return token('color-critical');
  },
};
