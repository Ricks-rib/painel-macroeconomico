import { AlertCircle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Carregando, vazio e erro.
 *
 * Existem como componentes porque um painel sem eles parece quebrado: a tela
 * fica em branco e quem esta olhando nao sabe se o dado nao existe, se ainda
 * vem, ou se algo falhou. Sao tres respostas diferentes.
 */

export function LoadingBlock({ height = 'h-64' }: { height?: string }) {
  return <Skeleton className={`w-full ${height}`} />;
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-5">
      <AlertCircle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-critical" />
      <div>
        <p className="text-sm font-medium text-ink">Nao foi possivel carregar</p>
        <p className="mt-1 text-xs text-ink-muted">{message}</p>
      </div>
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-5">
      <Inbox aria-hidden className="h-5 w-5 shrink-0 text-ink-muted" />
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingHeight?: string;
  children: ReactNode;
}

/**
 * Centraliza o tri-estado para as paginas nao repetirem o mesmo
 * `if (isLoading) ... if (error) ...` em cada bloco.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty = false,
  emptyMessage = 'Nenhum dado disponivel.',
  loadingHeight,
  children,
}: QueryStateProps) {
  if (isLoading) return <LoadingBlock {...(loadingHeight ? { height: loadingHeight } : {})} />;
  if (error) return <ErrorBlock message={error instanceof Error ? error.message : String(error)} />;
  if (isEmpty) return <EmptyBlock message={emptyMessage} />;
  return <>{children}</>;
}
