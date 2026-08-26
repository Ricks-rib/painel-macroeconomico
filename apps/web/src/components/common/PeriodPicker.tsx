import { PERIOD_OPTIONS, usePeriod, type PeriodDays } from '@/lib/period';
import { cn } from '@/lib/utils';

/**
 * Recorte temporal.
 *
 * Botoes visiveis em vez de menu suspenso: sao cinco opcoes, e a escolhida
 * precisa ficar legivel sem um clique. A selecao tem contorno e peso, nao so
 * cor de fundo.
 */
export function PeriodPicker() {
  const { days, setDays } = usePeriod();

  return (
    <div
      role="group"
      aria-label="Periodo exibido"
      className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface p-0.5"
    >
      {PERIOD_OPTIONS.map((option) => {
        const ativo = option.days === days;
        return (
          <button
            key={option.days}
            type="button"
            aria-pressed={ativo}
            onClick={() => setDays(option.days as PeriodDays)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              ativo ? 'bg-primary text-white' : 'text-ink-2 hover:bg-elevated',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
