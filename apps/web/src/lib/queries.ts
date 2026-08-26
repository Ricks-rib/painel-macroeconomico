import type {
  AssistantStatus,
  CatalogResponse,
  CategoryResponse,
  ChatRequest,
  ChatResponse,
  NarrativeResponse,
  OverviewResponse,
  SeriesCategory,
  SeriesDetail,
  SyncStatusResponse,
} from '@bcb/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { post, request } from './api';

/**
 * Estado de servidor.
 *
 * O problema real de um painel nao e buscar o numero -- e mante-lo atualizado
 * sem repintar a tela a cada respiro. Por isso os tempos abaixo sao escolhidos
 * por tipo de dado, e nao um valor unico para tudo.
 */

export const queryKeys = {
  overview: ['overview'] as const,
  narrative: ['overview', 'narrative'] as const,
  category: (categoria: SeriesCategory, days: number) => ['category', categoria, days] as const,
  series: (slug: string, days: number) => ['series', slug, days] as const,
  catalog: ['catalog'] as const,
  syncStatus: ['sync', 'status'] as const,
  assistantStatus: ['assistant', 'status'] as const,
};

/**
 * Serie economica nao muda de minuto em minuto: o BCB publica cambio uma vez
 * por dia util e IPCA uma vez por mes. Revalidar de 5 em 5 minutos e o
 * suficiente para nao exibir dado velho, e nao gera trafego a toa.
 */
const SERIES_STALE_MS = 5 * 60_000;

export function useOverview() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: () => request<OverviewResponse>('/api/overview'),
    staleTime: SERIES_STALE_MS,
    refetchInterval: SERIES_STALE_MS,
  });
}

/**
 * O resumo escrito pela IA e uma consulta separada de proposito.
 *
 * Os indicadores aparecem imediatamente; o texto chega quando o modelo local
 * terminar. Sem essa separacao, a tela inteira esperaria pelo componente menos
 * essencial -- e ficaria em branco quando o Ollama estivesse fora.
 */
export function useNarrative(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.narrative,
    queryFn: () => request<NarrativeResponse>('/api/overview/narrative'),
    enabled,
    staleTime: 30 * 60_000,
    // Geracao local e cara: nao refaz sozinha, so quando a pagina e remontada.
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCategory(categoria: SeriesCategory, days: number) {
  return useQuery({
    queryKey: queryKeys.category(categoria, days),
    queryFn: () => request<CategoryResponse>(`/api/categories/${categoria}?days=${days}`),
    staleTime: SERIES_STALE_MS,
    // Mantem o grafico anterior enquanto a nova janela carrega, em vez de
    // piscar um esqueleto a cada troca de periodo.
    placeholderData: (previous) => previous,
  });
}

export function useSeries(slug: string, days: number) {
  return useQuery({
    queryKey: queryKeys.series(slug, days),
    queryFn: () => request<SeriesDetail>(`/api/series/${slug}?days=${days}`),
    staleTime: SERIES_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: queryKeys.catalog,
    queryFn: () => request<CatalogResponse>('/api/catalog'),
    staleTime: 10 * 60_000,
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: queryKeys.syncStatus,
    queryFn: () => request<SyncStatusResponse>('/api/sync/status'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useTriggerSync() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => post<SyncStatusResponse>('/api/sync/run'),
    onSuccess: () => {
      // Sincronizou: todo dado exibido pode ter mudado.
      void client.invalidateQueries();
    },
  });
}

/** Disponibilidade do modelo local, consultada de minuto em minuto. */
export function useAssistantStatus() {
  return useQuery({
    queryKey: queryKeys.assistantStatus,
    queryFn: () => request<AssistantStatus>('/api/assistant/status'),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/**
 * Cada pergunta e um turno distinto -- por isso mutation, nao query: nao ha
 * cache a reaproveitar nem deduplicacao desejavel entre duas perguntas iguais.
 */
export function useChat() {
  return useMutation({
    mutationFn: (payload: ChatRequest) => post<ChatResponse>('/api/assistant/chat', payload),
  });
}
