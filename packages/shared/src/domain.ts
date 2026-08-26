/**
 * Vocabulario do dominio: as listas canonicas que backend e frontend precisam
 * concordar. Nao ha enum nativo do Prisma aqui de proposito -- SQLite nao
 * suporta, e mesmo que suportasse, a lista precisa existir no frontend (para
 * rotular e agrupar) sem importar tipo gerado pelo ORM.
 */

/** Categoria tematica: define a pagina em que a serie aparece. */
export const SERIES_CATEGORIES = ['JUROS', 'INFLACAO', 'CAMBIO', 'ATIVIDADE'] as const;
export type SeriesCategory = (typeof SERIES_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SeriesCategory, string> = {
  JUROS: 'Juros e Politica Monetaria',
  INFLACAO: 'Inflacao',
  CAMBIO: 'Cambio',
  ATIVIDADE: 'Atividade Economica e Credito',
};

/**
 * Frequencia de publicacao. Determina o TTL de sincronizacao: nao faz sentido
 * revalidar de hora em hora uma serie que o BCB publica uma vez por mes.
 */
export const SERIES_FREQUENCIES = ['DIARIA', 'MENSAL'] as const;
export type SeriesFrequency = (typeof SERIES_FREQUENCIES)[number];

/**
 * Polaridade do indicador: se subir, e bom, ruim ou nenhum dos dois?
 *
 * NEUTRAL nao e uma saida diplomatica -- e a leitura correta para boa parte
 * dos indicadores macro. Selic subindo nao e "ruim": e politica monetaria
 * contracionista, boa para quem tem renda fixa e ruim para quem vai tomar
 * credito. Dolar subindo favorece exportador e penaliza importador. Pintar
 * esses casos de verde ou vermelho e o painel emitindo um juizo que o dado
 * nao sustenta.
 */
export const BETTER_WHEN = ['HIGHER', 'LOWER', 'NEUTRAL'] as const;
export type BetterWhen = (typeof BETTER_WHEN)[number];

/**
 * Como comparar dois pontos da serie.
 *
 * RELATIVE   -- a serie e um nivel (R$ 5,15; PIB em R$ milhoes). Comparar em
 *               variacao percentual e o que se espera.
 * ABSOLUTE_PP -- a serie JA e um percentual (IPCA 0,16%; Selic 14% a.a.).
 *               Dizer que o IPCA "caiu 56%" ao ir de 0,16% para 0,07% e
 *               tecnicamente verdadeiro e praticamente inutil. A leitura
 *               correta e a diferenca em pontos percentuais: -0,09 p.p.
 */
export const COMPARE_AS = ['RELATIVE', 'ABSOLUTE_PP'] as const;
export type CompareAs = (typeof COMPARE_AS)[number];

/** Um ponto de serie temporal, ja normalizado (data ISO, valor numerico). */
export interface SeriesPoint {
  /** Data do dado no formato ISO `AAAA-MM-DD` (nao o `DD/MM/AAAA` do BCB). */
  data: string;
  valor: number;
}

/** Estado de uma execucao do job de sincronizacao. */
export const SYNC_STATUSES = ['RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];
