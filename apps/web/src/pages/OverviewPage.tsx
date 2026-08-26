import { CATEGORY_LABELS, type ScreenContext } from '@bcb/shared';
import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { KpiCard } from '@/components/common/KpiCard';
import { QueryState } from '@/components/common/StateViews';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNarrative, useOverview } from '@/lib/queries';
import { useRegisterScreenContext } from '@/lib/screen-context';

export function OverviewPage() {
  const { data, isLoading, error } = useOverview();

  // O resumo so e pedido depois que ha dado -- gerar texto sobre uma tela vazia
  // seria pagar o custo do modelo para nao dizer nada.
  const narrative = useNarrative(Boolean(data?.headline.length));

  useRegisterScreenContext(
    useMemo((): ScreenContext | null => {
      if (!data) return null;
      const visiveis = data.headline.filter((item) => item.latest !== null);
      if (visiveis.length === 0) return null;

      return {
        pagina: 'Visao Geral',
        periodoDias: null,
        series: visiveis.map((item) => ({
          codigo: item.meta.codigo,
          slug: item.meta.slug,
          nome: item.meta.nome,
          unidade: item.meta.unidade,
          valorAtual: item.latest?.valor ?? 0,
          dataAtual: item.latest?.data ?? '',
        })),
      };
    }, [data]),
  );

  return (
    <AppShell
      title="Visao Geral"
      description="Panorama de juros, precos, cambio e atividade economica."
    >
      <QueryState isLoading={isLoading} error={error}>
        <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data?.headline.map((summary) => <KpiCard key={summary.meta.slug} summary={summary} />)}
        </section>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles aria-hidden className="h-4 w-4 text-primary" />
              Leitura do periodo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {narrative.isLoading ? (
              <p className="text-sm text-ink-muted animate-pulse-subtle">
                Gerando a leitura com o modelo local...
              </p>
            ) : narrative.data?.text ? (
              <p className="text-sm leading-relaxed text-ink-2">{narrative.data.text}</p>
            ) : (
              /* Sem o modelo, o cartao explica a ausencia em vez de sumir: o
                 painel nao esconde que uma parte dele depende de algo externo. */
              <p className="text-sm text-ink-muted">
                {narrative.data?.unavailableReason ??
                  'Resumo automatico indisponivel no momento. Os indicadores acima nao dependem dele.'}
              </p>
            )}
          </CardContent>
        </Card>

        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {data?.categories
            .filter((grupo) => grupo.series.length > 0)
            .map((grupo) => (
              <Card key={grupo.categoria}>
                <CardHeader>
                  <CardTitle>{CATEGORY_LABELS[grupo.categoria]}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {grupo.series.map((summary) => (
                    <KpiCard key={summary.meta.slug} summary={summary} compact />
                  ))}
                </CardContent>
              </Card>
            ))}
        </section>
      </QueryState>
    </AppShell>
  );
}
