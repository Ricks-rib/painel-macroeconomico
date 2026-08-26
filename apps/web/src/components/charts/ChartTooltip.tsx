import type { SeriesMeta } from '@bcb/shared';
import { formatDate, formatValue } from '@/lib/format';

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayloadItem[];
  /** Metadados por chave de serie, para formatar cada valor na sua unidade. */
  metaByKey: Record<string, SeriesMeta>;
}

/**
 * Tooltip do grafico.
 *
 * Cada linha traz a marca colorida ao lado do nome -- a cor identifica a serie,
 * mas nunca sozinha: o nome esta escrito. O valor usa a unidade da propria
 * serie, porque um grafico de inflacao e um de cambio nao se leem igual.
 */
export function ChartTooltip({ active, label, payload, metaByKey }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2 shadow-sm">
      {label ? <p className="mb-1 text-xs text-ink-muted tabular">{formatDate(label)}</p> : null}

      <ul className="flex flex-col gap-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? '');
          const meta = metaByKey[key];
          if (!meta || item.value === undefined) return null;

          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-ink-2">{meta.nome}</span>
              <span className="ml-auto font-medium text-ink tabular">
                {formatValue(item.value, meta)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
