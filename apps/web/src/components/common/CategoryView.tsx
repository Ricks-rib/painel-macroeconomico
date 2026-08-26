import type { ScreenContext, SeriesCategory, SeriesDetail } from '@bcb/shared';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendChart } from '@/components/charts/TrendChart';
import { KpiCard } from '@/components/common/KpiCard';
import { PeriodPicker } from '@/components/common/PeriodPicker';
import { SourceBadge } from '@/components/common/SourceBadge';
import { QueryState } from '@/components/common/StateViews';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePeriod } from '@/lib/period';
import { useCategory } from '@/lib/queries';
import { useRegisterScreenContext } from '@/lib/screen-context';

interface CategoryViewProps {
  categoria: SeriesCategory;
  title: string;
  description: string;
}

/**
 * Uma pagina de categoria.
 *
 * As quatro areas tem a mesma forma -- linha de indicadores, graficos, recorte
 * de periodo --, entao existe um componente e quatro invocacoes, em vez de
 * quatro telas quase iguais que divergem no primeiro ajuste.
 */
export function CategoryView({ categoria, title, description }: CategoryViewProps) {
  const { days } = usePeriod();
  const navigate = useNavigate();
  const { data, isLoading, error } = useCategory(categoria, days);

  const comDados = useMemo(
    () => (data?.series ?? []).filter((item) => item.points.length > 0),
    [data],
  );

  // O que esta na tela agora -- lido pelo assistente quando a pergunta chegar.
  useRegisterScreenContext(useMemo(() => toScreenContext(title, days, comDados), [title, days, comDados]));

  const grupos = useMemo(() => groupByUnit(comDados), [comDados]);

  return (
    <AppShell
      title={title}
      description={description}
      actions={
        <>
          <PeriodPicker />
          <Button variant="outline" size="md" onClick={() => navigate('/assistente')}>
            <MessageSquare aria-hidden className="h-4 w-4" />
            Perguntar a IA
          </Button>
        </>
      }
    >
      <QueryState
        isLoading={isLoading}
        error={error}
        isEmpty={comDados.length === 0}
        emptyMessage="Nenhuma serie sincronizada nesta area. Rode uma sincronizacao em Configuracoes."
      >
        <section aria-label="Indicadores" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {comDados.map((item) => (
            <KpiCard
              key={item.meta.slug}
              summary={{
                meta: item.meta,
                latest: item.latest,
                change: item.change,
                sparkline: item.points.slice(-24),
                syncedAt: item.syncedAt,
              }}
            />
          ))}
        </section>

        <section className="mt-6 flex flex-col gap-5">
          {grupos.map((grupo) => (
            <Card key={grupo.unidade}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{tituloDoGrupo(grupo.series, grupo.unidade)}</CardTitle>
                    <CardDescription>
                      {grupo.series.length === 1
                        ? grupo.series[0]?.meta.descricao
                        : `Escala em ${grupo.unidade}.`}
                    </CardDescription>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {grupo.series.map((item) => (
                      <SourceBadge
                        key={item.meta.slug}
                        codigo={item.meta.codigo}
                        nome={item.meta.nome}
                      />
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <TrendChart series={grupo.series} />
              </CardContent>
            </Card>
          ))}
        </section>
      </QueryState>
    </AppShell>
  );
}

interface UnitGroup {
  unidade: string;
  series: SeriesDetail[];
}

/**
 * Agrupa por unidade -- a regra que impede o grafico de dois eixos.
 *
 * Na area de juros convivem a meta Selic (% ao ano, na casa dos 14), a Selic
 * efetiva (% ao dia, na casa dos 0,05) e o CDI acumulado no mes. Sobrepor isso
 * numa figura so exigiria duas escalas verticais, e o cruzamento das linhas
 * passaria a depender de como cada eixo foi esticado -- nao do dado. Um
 * grafico por unidade resolve sem inventar leitura nenhuma.
 */
function groupByUnit(series: SeriesDetail[]): UnitGroup[] {
  const mapa = new Map<string, SeriesDetail[]>();

  for (const item of series) {
    const atual = mapa.get(item.meta.unidade) ?? [];
    atual.push(item);
    mapa.set(item.meta.unidade, atual);
  }

  return [...mapa.entries()].map(([unidade, lista]) => ({ unidade, series: lista }));
}

function tituloDoGrupo(series: SeriesDetail[], unidade: string): string {
  if (series.length === 1) return series[0]?.meta.nome ?? unidade;
  return series.map((item) => item.meta.nome).join(' x ');
}

function toScreenContext(
  pagina: string,
  periodoDias: number,
  series: SeriesDetail[],
): ScreenContext | null {
  const visiveis = series.filter((item) => item.latest !== null).slice(0, 12);
  if (visiveis.length === 0) return null;

  return {
    pagina,
    periodoDias,
    series: visiveis.map((item) => ({
      codigo: item.meta.codigo,
      slug: item.meta.slug,
      nome: item.meta.nome,
      unidade: item.meta.unidade,
      valorAtual: item.latest?.valor ?? 0,
      dataAtual: item.latest?.data ?? '',
    })),
  };
}
