import type { SyncStatusResponse } from '@bcb/shared';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatAge } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Idade do dado.
 *
 * Este painel le de uma copia local que um job atualiza -- ou seja, e
 * eventualmente consistente por construcao. Exibir isso nao e transparencia
 * decorativa: um painel que assume esse custo e nao informa esta mentindo por
 * omissao, e quem toma decisao com o numero precisa saber de quando ele e.
 *
 * Tambem mostra as series que falharam na ultima tentativa. Ausencia de erro
 * na tela nao pode significar "nao olhei".
 */
export function SyncIndicator({ sync }: { sync: SyncStatusResponse | undefined }) {
  if (!sync) return null;

  const temFalhas = sync.failures.length > 0;
  const muitoVelho = sync.stalestMinutes !== null && sync.stalestMinutes > 24 * 60;
  const alerta = temFalhas || muitoVelho || sync.stalestMinutes === null;

  const Icon = sync.running ? RefreshCw : alerta ? AlertTriangle : CheckCircle2;

  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon
        aria-hidden
        className={cn(
          'h-3.5 w-3.5',
          sync.running && 'animate-pulse-subtle text-primary',
          !sync.running && (alerta ? 'text-warning' : 'text-good'),
        )}
      />

      <span className={cn(alerta ? 'text-warning' : 'text-ink-muted')}>
        {sync.running
          ? 'Sincronizando com o Banco Central...'
          : `Dados atualizados ${formatAge(sync.stalestMinutes)}`}
      </span>

      {temFalhas ? (
        <span
          className="text-warning"
          title={sync.failures.map((f) => `${f.nome}: ${f.error}`).join('\n')}
        >
          ({sync.failures.length}{' '}
          {sync.failures.length === 1 ? 'serie com falha' : 'series com falha'})
        </span>
      ) : null}
    </div>
  );
}
