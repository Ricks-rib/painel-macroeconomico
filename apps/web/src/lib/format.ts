import type { SeriesChange, SeriesMeta } from '@bcb/shared';

/**
 * Formatacao. O frontend formata; nao calcula.
 *
 * Toda funcao aqui recebe um numero pronto do servidor e decide apenas como
 * escreve-lo. No dia em que a regra de uma metrica mudar, este arquivo nao e
 * consultado -- a mudanca acontece em `@bcb/shared/metrics`, uma vez.
 */

const ptBR = 'pt-BR';

export function formatNumber(value: number, casasDecimais: number): string {
  return new Intl.NumberFormat(ptBR, {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  }).format(value);
}

/** Valor com a unidade da serie, no formato que a unidade pede. */
export function formatValue(value: number, meta: Pick<SeriesMeta, 'unidade' | 'casasDecimais'>): string {
  const numero = formatNumber(value, meta.casasDecimais);

  // "R$" vem antes; "%" e "% a.a." vem depois.
  if (meta.unidade.startsWith('R$')) {
    const sufixo = meta.unidade.replace('R$', '').trim();
    return sufixo ? `R$ ${numero} ${sufixo}` : `R$ ${numero}`;
  }

  return `${numero}${meta.unidade.startsWith('%') ? '' : ' '}${meta.unidade}`;
}

/**
 * Escreve a variacao com a unidade certa.
 *
 * `p.p.` para indicadores que ja sao percentuais e `%` para os de nivel. A
 * escolha vem do servidor, em `change.primaryUnit` -- repetir a regra aqui
 * criaria uma segunda chance de errar.
 */
export function formatChange(change: SeriesChange | null): string | null {
  if (!change || change.primary === null) return null;

  const sinal = change.primary > 0 ? '+' : '';
  const numero = formatNumber(change.primary, 2);
  return change.primaryUnit === 'PP' ? `${sinal}${numero} p.p.` : `${sinal}${numero}%`;
}

/** `AAAA-MM-DD` -> `24/08/2026`. */
export function formatDate(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** `AAAA-MM-DD` -> `ago/2026`, para eixos de series mensais. */
export function formatMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(ptBR, { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(date)
    .replace('. de ', '/');
}

/** Rotulo do eixo conforme a frequencia: dia para diaria, mes para mensal. */
export function formatAxisDate(iso: string, frequencia: SeriesMeta['frequencia']): string {
  if (frequencia === 'MENSAL') return formatMonth(iso);
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

/** Idade do dado em linguagem corrente. */
export function formatAge(minutes: number | null): string {
  if (minutes === null) return 'nunca sincronizado';
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `ha ${minutes} min`;

  const horas = Math.floor(minutes / 60);
  if (horas < 24) return `ha ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ha 1 dia' : `ha ${dias} dias`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  return new Intl.DateTimeFormat(ptBR, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}
