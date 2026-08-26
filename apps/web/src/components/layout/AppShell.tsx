import type { ReactNode } from 'react';
import { SyncIndicator } from '@/components/common/SyncIndicator';
import { useSyncStatus } from '@/lib/queries';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Moldura das paginas.
 *
 * O cabecalho traz sempre a idade do dado, em todas as telas -- e informacao
 * que muda a leitura de qualquer numero abaixo dela, entao nao pode ficar
 * escondida numa pagina de status.
 */
export function AppShell({ title, description, actions, children }: AppShellProps) {
  const { data: sync } = useSyncStatus();

  return (
    <div className="flex h-full">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-hairline bg-surface px-7 py-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-ink">{title}</h1>
            {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
            <div className="mt-2">
              <SyncIndicator sync={sync} />
            </div>
          </div>

          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>

        <main className="flex-1 overflow-y-auto px-7 py-6">{children}</main>
      </div>
    </div>
  );
}
