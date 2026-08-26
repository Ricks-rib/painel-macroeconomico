import { CATEGORY_LABELS } from '@bcb/shared';
import { CheckCircle2, CircleDashed, ExternalLink, RefreshCw } from 'lucide-react';
import { QueryState } from '@/components/common/StateViews';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAssistantStatus, useCatalog, useSyncStatus, useTriggerSync } from '@/lib/queries';

/**
 * Configuracoes -- e, sobretudo, auditoria.
 *
 * Esta e a unica tela onde aparecem as series NAO verificadas. A intencao e o
 * oposto de esconder: quem usa o painel consegue ver qual codigo do SGS
 * alimenta cada indicador, quando foi conferido, com que evidencia, e abrir o
 * catalogo oficial para conferir por conta propria.
 */
export function SettingsPage() {
  const catalog = useCatalog();
  const { data: sync } = useSyncStatus();
  const { data: assistant } = useAssistantStatus();
  const trigger = useTriggerSync();

  return (
    <AppShell
      title="Configuracoes"
      description="Origem dos dados, estado da sincronizacao e do modelo local."
      actions={
        <Button
          variant="primary"
          onClick={() => trigger.mutate()}
          disabled={trigger.isPending || sync?.running}
        >
          <RefreshCw aria-hidden className={`h-4 w-4 ${trigger.isPending ? 'animate-spin' : ''}`} />
          {trigger.isPending ? 'Sincronizando...' : 'Sincronizar agora'}
        </Button>
      }
    >
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sincronizacao</CardTitle>
            <CardDescription>Ultima leitura da API do Banco Central.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Linha rotulo="Ultima execucao" valor={formatDateTime(sync?.lastRunAt ?? null)} />
            <Linha rotulo="Situacao" valor={sync?.lastRunStatus ?? '--'} />
            <Linha rotulo="Ultimo sucesso" valor={formatDateTime(sync?.lastSuccessAt ?? null)} />

            {sync?.failures.length ? (
              <div className="mt-1 rounded border border-hairline bg-elevated p-2">
                <p className="text-xs font-medium text-warning">Series com falha</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {sync.failures.map((falha) => (
                    <li key={falha.codigo} className="text-[11px] text-ink-muted">
                      <span className="tabular">#{falha.codigo}</span> {falha.nome}: {falha.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modelo local</CardTitle>
            <CardDescription>
              Usado apenas para o resumo e a conversa. O painel funciona sem ele.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Linha rotulo="Modelo" valor={assistant?.model ?? '--'} />
            <Linha rotulo="Situacao" valor={assistant?.availability ?? '--'} />
            {assistant?.message ? (
              <p className="text-xs text-ink-muted">{assistant.message}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-5">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Catalogo de series</CardTitle>
              <CardDescription>
                Cada indicador do painel e uma serie do SGS. Um codigo do SGS e um numero opaco --
                por isso cada um foi conferido contra a API real antes de entrar, e o que foi
                conferido esta anotado aqui.
              </CardDescription>
            </div>

            <a
              href={catalog.data?.sgsUrl ?? 'https://www3.bcb.gov.br/sgspub'}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
            >
              Catalogo oficial <ExternalLink aria-hidden className="h-3 w-3" />
            </a>
          </div>
        </CardHeader>

        <CardContent>
          <QueryState isLoading={catalog.isLoading} error={catalog.error} loadingHeight="h-72">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted">
                    <th className="py-2 pr-3 font-medium">Serie</th>
                    <th className="py-2 pr-3 font-medium">Codigo</th>
                    <th className="py-2 pr-3 font-medium">Area</th>
                    <th className="py-2 pr-3 font-medium">Pontos</th>
                    <th className="py-2 pr-3 font-medium">Ultimo dado</th>
                    <th className="py-2 pr-3 font-medium">Conferencia</th>
                  </tr>
                </thead>

                <tbody>
                  {catalog.data?.entries.map((entry) => (
                    <tr key={entry.codigo} className="border-b border-hairline align-top">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-ink">{entry.nome}</p>
                        {entry.notes ? (
                          <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-ink-muted">
                            {entry.notes}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-ink-2 tabular">{entry.codigo}</td>
                      <td className="py-2 pr-3 text-ink-2">{CATEGORY_LABELS[entry.categoria]}</td>
                      <td className="py-2 pr-3 text-ink-2 tabular">{entry.pointCount}</td>
                      <td className="py-2 pr-3 text-ink-2 tabular">
                        {entry.latestData ? formatDate(entry.latestData) : '--'}
                      </td>
                      <td className="py-2 pr-3">
                        {entry.verified ? (
                          <Badge tone="good">
                            <CheckCircle2 aria-hidden className="h-3 w-3" />
                            {entry.verifiedAt ? formatDate(entry.verifiedAt) : 'conferida'}
                          </Badge>
                        ) : (
                          <Badge tone="warning">
                            <CircleDashed aria-hidden className="h-3 w-3" />
                            em validacao
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-muted">{rotulo}</span>
      <span className="text-ink tabular">{valor}</span>
    </div>
  );
}
