import type { SeriesCategory, SeriesPoint, SyncStatus } from './domain.js';
import type { SeriesChange } from './metrics.js';
import type { SeriesDefinition } from './series-catalog.js';

/**
 * O que atravessa a rede.
 *
 * Regra de dependencia: o frontend nunca importa tipo gerado pelo Prisma. Se a
 * forma das tabelas vazasse para a tela, mexer no schema viraria mexer em
 * componente. O que a API promete esta declarado aqui, e so aqui.
 */

/** Metadados da serie enviados ao cliente (subconjunto do catalogo). */
export type SeriesMeta = Pick<
  SeriesDefinition,
  | 'codigo'
  | 'slug'
  | 'nome'
  | 'descricao'
  | 'unidade'
  | 'categoria'
  | 'frequencia'
  | 'casasDecimais'
  | 'betterWhen'
  | 'compareAs'
>;

/** Estado atual de um indicador: o suficiente para pintar um card. */
export interface SeriesSummary {
  meta: SeriesMeta;
  /** `null` quando a serie ainda nao foi sincronizada com sucesso. */
  latest: SeriesPoint | null;
  /** Variacao em relacao ao ponto anterior. */
  change: SeriesChange | null;
  /** Serie curta para o sparkline do card. */
  sparkline: SeriesPoint[];
  /** Quando este indicador foi sincronizado pela ultima vez (ISO). */
  syncedAt: string | null;
}

/** Serie completa para uma pagina de detalhe. */
export interface SeriesDetail {
  meta: SeriesMeta;
  points: SeriesPoint[];
  latest: SeriesPoint | null;
  /** Variacao ao longo da janela consultada (nao apenas do ultimo ponto). */
  windowChange: SeriesChange | null;
  change: SeriesChange | null;
  syncedAt: string | null;
  /** Janela em dias efetivamente aplicada. */
  periodDays: number | null;
}

/**
 * Idade e saude do dado.
 *
 * Um painel alimentado por fonte externa e eventualmente consistente por
 * natureza. Exibir isso nao e detalhe de implementacao: um painel que assume
 * esse custo e nao informa esta mentindo por omissao.
 */
export interface SyncStatusResponse {
  lastRunAt: string | null;
  lastRunStatus: SyncStatus | null;
  /** Sincronizacao bem-sucedida mais recente, em qualquer serie. */
  lastSuccessAt: string | null;
  /** Series que falharam na ultima execucao, com o motivo. */
  failures: Array<{ codigo: number; nome: string; error: string }>;
  /** Idade do dado mais velho entre as series exibidas, em minutos. */
  stalestMinutes: number | null;
  running: boolean;
}

export interface OverviewResponse {
  headline: SeriesSummary[];
  categories: Array<{ categoria: SeriesCategory; series: SeriesSummary[] }>;
  sync: SyncStatusResponse;
}

export interface CategoryResponse {
  categoria: SeriesCategory;
  series: SeriesDetail[];
  sync: SyncStatusResponse;
}

/** Item da tabela de auditoria do catalogo, na tela de Configuracoes. */
export interface CatalogEntry {
  codigo: number;
  slug: string;
  nome: string;
  categoria: SeriesCategory;
  unidade: string;
  verified: boolean;
  verifiedAt: string | null;
  notes: string | null;
  pointCount: number;
  latestData: string | null;
  syncedAt: string | null;
}

export interface CatalogResponse {
  entries: CatalogEntry[];
  sgsUrl: string;
}

/** Corpo de erro padronizado da API. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
