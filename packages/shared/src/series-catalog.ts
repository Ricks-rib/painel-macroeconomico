import type { BetterWhen, CompareAs, SeriesCategory, SeriesFrequency } from './domain.js';

/**
 * O catalogo de series do SGS/BCB -- fonte unica da verdade.
 *
 * Consumido pelo job de sincronizacao (o que buscar), pelas ferramentas da IA
 * (o que o modelo pode consultar) e pelo frontend (como rotular e formatar).
 * Adicionar um indicador ao painel e adicionar uma linha aqui: nao ha migracao
 * de schema, porque os pontos vivem numa tabela generica por codigo.
 *
 * REGRA: nada entra em sincronizacao, em ferramenta de IA ou em grafico sem
 * `verified: true`. Um codigo do SGS e um numero opaco -- 20714 parecia
 * inadimplencia de pessoa fisica e devolveu ~33%, valor impossivel para
 * inadimplencia de credito. Publicar isso como indicador seria um erro que o
 * usuario nao teria como detectar. Por isso a verificacao e um campo do dado,
 * nao uma etapa que alguem lembra de fazer.
 */

export interface SeriesDefinition {
  /** Codigo da serie no SGS. */
  codigo: number;
  /** Identificador estavel usado em URLs e nos argumentos das ferramentas de IA. */
  slug: string;
  nome: string;
  /** Descricao curta: aparece em tooltip e no contexto enviado ao modelo. */
  descricao: string;
  unidade: string;
  categoria: SeriesCategory;
  frequencia: SeriesFrequency;
  casasDecimais: number;
  betterWhen: BetterWhen;
  compareAs: CompareAs;
  /** Quantos anos de historico carregar no backfill inicial. */
  historyYears: number;
  /**
   * `false` mantem a serie fora de tudo que e exibido ou consultado pela IA.
   * Ela aparece apenas na tela de Configuracoes, marcada como pendente.
   */
  verified: boolean;
  /** Data (ISO) da ultima conferencia contra a API real. */
  verifiedAt?: string;
  /** O que foi conferido, para quem auditar depois nao precisar refazer do zero. */
  notes?: string;
}

const VERIFIED_ON = '2026-08-25';

export const SERIES_CATALOG: readonly SeriesDefinition[] = [
  // --- Juros e politica monetaria -----------------------------------------
  {
    codigo: 432,
    slug: 'meta-selic',
    nome: 'Meta Selic',
    descricao: 'Meta da taxa Selic definida pelo Copom, em percentual ao ano.',
    unidade: '% a.a.',
    categoria: 'JUROS',
    frequencia: 'DIARIA',
    casasDecimais: 2,
    betterWhen: 'NEUTRAL',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 5,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes:
      'Serie diaria (repete o mesmo valor entre reunioes do Copom), nao mensal. Conferido: 14,00% a.a. em dias consecutivos de 09/2026.',
  },
  {
    codigo: 11,
    slug: 'selic-diaria',
    nome: 'Selic efetiva (taxa diaria)',
    descricao:
      'Taxa Selic efetivamente praticada, expressa ao dia. Nao confundir com a meta anual: 0,0517% ao dia equivale a cerca de 13,9% ao ano.',
    unidade: '% a.d.',
    categoria: 'JUROS',
    frequencia: 'DIARIA',
    casasDecimais: 6,
    betterWhen: 'NEUTRAL',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 5,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes:
      'Retorna 0,051660 (% ao dia). Composto em 252 dias uteis da ~13,9% a.a., coerente com a meta de 14% da serie 432 -- foi assim que a unidade foi confirmada.',
  },
  {
    codigo: 12,
    slug: 'cdi-diario',
    nome: 'CDI (taxa diaria)',
    descricao: 'Taxa CDI expressa ao dia. Acompanha a Selic efetiva de perto.',
    unidade: '% a.d.',
    categoria: 'JUROS',
    frequencia: 'DIARIA',
    casasDecimais: 6,
    betterWhen: 'NEUTRAL',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 5,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes:
      'Devolve valor identico a serie 11 nas datas conferidas. Isso e esperado, nao defeito: o CDI acompanha a Selic efetiva e a diferenca costuma sumir no arredondamento. Mantido como serie propria porque a coincidencia e conjuntural, nao definicional.',
  },
  {
    codigo: 4390,
    slug: 'cdi-mensal',
    nome: 'CDI acumulado no mes',
    descricao: 'Taxa CDI acumulada no mes, em percentual.',
    unidade: '%',
    categoria: 'JUROS',
    frequencia: 'MENSAL',
    casasDecimais: 2,
    betterWhen: 'NEUTRAL',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
  },

  // --- Inflacao ------------------------------------------------------------
  {
    codigo: 433,
    slug: 'ipca-mensal',
    nome: 'IPCA (variacao mensal)',
    descricao: 'Indice Nacional de Precos ao Consumidor Amplo, variacao no mes.',
    unidade: '%',
    categoria: 'INFLACAO',
    frequencia: 'MENSAL',
    casasDecimais: 2,
    betterWhen: 'LOWER',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
  },
  {
    codigo: 13522,
    slug: 'ipca-12m',
    nome: 'IPCA acumulado em 12 meses',
    descricao:
      'IPCA acumulado nos ultimos doze meses -- a leitura usada para comparar com a meta de inflacao.',
    unidade: '%',
    categoria: 'INFLACAO',
    frequencia: 'MENSAL',
    casasDecimais: 2,
    betterWhen: 'LOWER',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes:
      'Conferido: 4,39 / 4,72 / 4,64 / 4,44 em meses consecutivos -- varia mes a mes, como um acumulado deve variar. O codigo 13521 foi testado antes e REPROVADO para este fim: devolveu 3,00 fixo em 2024, 2025 e 2026, padrao de meta de inflacao, nao de indice acumulado.',
  },
  {
    codigo: 189,
    slug: 'igpm-mensal',
    nome: 'IGP-M (variacao mensal)',
    descricao: 'Indice Geral de Precos - Mercado, variacao no mes. Referencia de reajuste de alugueis.',
    unidade: '%',
    categoria: 'INFLACAO',
    frequencia: 'MENSAL',
    casasDecimais: 2,
    betterWhen: 'LOWER',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
  },

  // --- Cambio --------------------------------------------------------------
  {
    codigo: 1,
    slug: 'dolar-comercial',
    nome: 'Dolar comercial (compra)',
    descricao: 'Taxa de cambio livre, dolar americano, ponta de compra.',
    unidade: 'R$',
    categoria: 'CAMBIO',
    frequencia: 'DIARIA',
    casasDecimais: 4,
    betterWhen: 'NEUTRAL',
    compareAs: 'RELATIVE',
    historyYears: 5,
    verified: true,
    verifiedAt: VERIFIED_ON,
  },
  {
    codigo: 10813,
    slug: 'dolar-ptax',
    nome: 'Dolar PTAX (venda)',
    descricao: 'Taxa PTAX de venda do dolar -- a referencia usada em contratos indexados.',
    unidade: 'R$',
    categoria: 'CAMBIO',
    frequencia: 'DIARIA',
    casasDecimais: 4,
    betterWhen: 'NEUTRAL',
    compareAs: 'RELATIVE',
    historyYears: 5,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes: 'Proximo da serie 1 com pequena diferenca de ponta (compra x venda), como esperado.',
  },
  {
    codigo: 21619,
    slug: 'euro-ptax',
    nome: 'Euro PTAX (venda)',
    descricao: 'Taxa PTAX de venda do euro.',
    unidade: 'R$',
    categoria: 'CAMBIO',
    frequencia: 'DIARIA',
    casasDecimais: 4,
    betterWhen: 'NEUTRAL',
    compareAs: 'RELATIVE',
    historyYears: 5,
    verified: true,
    verifiedAt: VERIFIED_ON,
  },

  // --- Atividade economica e credito ---------------------------------------
  {
    codigo: 4380,
    slug: 'pib-mensal',
    nome: 'PIB mensal (valores correntes)',
    descricao: 'Produto Interno Bruto mensal a precos correntes, em R$ milhoes.',
    unidade: 'R$ milhoes',
    categoria: 'ATIVIDADE',
    frequencia: 'MENSAL',
    casasDecimais: 0,
    betterWhen: 'HIGHER',
    compareAs: 'RELATIVE',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
  },
  {
    codigo: 20539,
    slug: 'credito-saldo-total',
    nome: 'Saldo da carteira de credito',
    descricao: 'Estoque total de credito do sistema financeiro, em R$ milhoes.',
    unidade: 'R$ milhoes',
    categoria: 'ATIVIDADE',
    frequencia: 'MENSAL',
    casasDecimais: 0,
    betterWhen: 'NEUTRAL',
    compareAs: 'RELATIVE',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes:
      'Conferido: ~7,24 a 7,36 milhoes de R$ milhoes, ou seja, R$ 7,2-7,4 trilhoes de estoque, ordem de grandeza compativel com o credito total do SFN. Crescimento mensal suave, como estoque deve se comportar.',
  },
  {
    codigo: 21082,
    slug: 'inadimplencia-total',
    nome: 'Inadimplencia do credito (total)',
    descricao: 'Percentual da carteira de credito com atraso superior a 90 dias.',
    unidade: '%',
    categoria: 'ATIVIDADE',
    frequencia: 'MENSAL',
    casasDecimais: 2,
    betterWhen: 'LOWER',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes:
      'Conferido: 4,53 a 4,74%, faixa plausivel de inadimplencia, e consistentemente abaixo da serie 21084 (pessoa fisica), relacao esperada porque a carteira de pessoa juridica puxa o total para baixo. O codigo 20714 foi testado e DESCARTADO: devolveu ~33%, impossivel para inadimplencia.',
  },
  {
    codigo: 21084,
    slug: 'inadimplencia-pf',
    nome: 'Inadimplencia do credito (pessoas fisicas)',
    descricao: 'Percentual da carteira de credito de pessoas fisicas com atraso superior a 90 dias.',
    unidade: '%',
    categoria: 'ATIVIDADE',
    frequencia: 'MENSAL',
    casasDecimais: 2,
    betterWhen: 'LOWER',
    compareAs: 'ABSOLUTE_PP',
    historyYears: 10,
    verified: true,
    verifiedAt: VERIFIED_ON,
    notes: 'Conferido: 5,40 a 5,62%, sempre ~0,9 p.p. acima do total (serie 21082), como esperado.',
  },
];

/** Series efetivamente utilizaveis: as unicas que o sync, a IA e os graficos enxergam. */
export const VERIFIED_SERIES: readonly SeriesDefinition[] = SERIES_CATALOG.filter((s) => s.verified);

export function findSeriesBySlug(slug: string): SeriesDefinition | undefined {
  return VERIFIED_SERIES.find((s) => s.slug === slug);
}

export function findSeriesByCodigo(codigo: number): SeriesDefinition | undefined {
  return VERIFIED_SERIES.find((s) => s.codigo === codigo);
}

export function seriesByCategory(categoria: SeriesCategory): readonly SeriesDefinition[] {
  return VERIFIED_SERIES.filter((s) => s.categoria === categoria);
}

/**
 * Os indicadores que abrem o painel e alimentam o resumo automatico.
 * Um de cada categoria: nao e um "top 4" arbitrario, e a leitura minima de
 * juros, precos, cambio e atividade.
 */
export const HEADLINE_SLUGS = ['meta-selic', 'ipca-12m', 'dolar-ptax', 'pib-mensal'] as const;
