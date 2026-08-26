import type { ToolCallTrace as Trace } from '@bcb/shared';
import { Check, Database, TriangleAlert } from 'lucide-react';

/**
 * As consultas que a resposta usou.
 *
 * Um chat sobre numeros que mostra apenas o texto pede confianca cega. Aqui
 * fica visivel qual ferramenta foi chamada, com que argumentos e em quanto
 * tempo -- e, quando nenhuma foi chamada, isso tambem aparece, porque
 * significa que a resposta veio do que ja estava na tela.
 */
export function ToolCallTraceList({ traces }: { traces: Trace[] }) {
  if (traces.length === 0) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
        <Database aria-hidden className="h-3 w-3" />
        Respondido a partir dos dados exibidos na tela.
      </p>
    );
  }

  return (
    <ul className="mt-2 flex flex-col gap-1">
      {traces.map((trace, index) => {
        const falhou = trace.status === 'ERROR';
        const semDado = trace.status === 'NO_DATA';

        return (
          <li
            key={`${trace.name}-${index}`}
            className="flex items-start gap-1.5 text-[11px] text-ink-muted"
          >
            {falhou || semDado ? (
              <TriangleAlert aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
            ) : (
              <Check aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-good" />
            )}

            <span className="min-w-0">
              <code className="text-ink-2">{trace.name}</code>
              {Object.keys(trace.args).length > 0 ? (
                <span className="text-ink-muted"> ({formatArgs(trace.args)})</span>
              ) : null}
              <span className="tabular"> · {trace.durationMs} ms</span>
              {falhou || semDado ? <span className="block text-warning">{trace.summary}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');
}
