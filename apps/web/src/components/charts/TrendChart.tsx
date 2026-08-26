import type { SeriesDetail, SeriesMeta } from '@bcb/shared';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisDate, formatNumber } from '@/lib/format';
import { ChartTooltip } from './ChartTooltip';
import { chartTheme, seriesColor } from './theme';

interface TrendChartProps {
  /**
   * Series a desenhar juntas. Devem COMPARTILHAR A UNIDADE -- ver o comentario
   * sobre eixo unico abaixo.
   */
  series: SeriesDetail[];
  height?: number;
}

interface MergedRow {
  data: string;
  [key: string]: string | number | null;
}

/**
 * Grafico de linha com eixo unico.
 *
 * NUNCA DOIS EIXOS Y. Sobrepor Selic (14% ao ano) e Selic diaria (0,05% ao dia)
 * numa figura com duas escalas produz cruzamentos que nao significam nada: o
 * ponto onde as linhas se encontram depende de como cada eixo foi esticado, e
 * nao do dado. Indicadores de unidades diferentes viram graficos diferentes --
 * e por isso este componente recebe uma lista ja agrupada por unidade, e a
 * pagina desenha um grafico por grupo.
 */
export function TrendChart({ series, height = 260 }: TrendChartProps) {
  const { rows, metaByKey } = useMemo(() => buildRows(series), [series]);

  const first = series[0];
  if (!first || rows.length === 0) return null;

  const frequencia = first.meta.frequencia;
  const casasNoEixo = Math.min(first.meta.casasDecimais, 2);

  return (
    <div>
      {series.length > 1 ? (
        // Legenda sempre presente com duas ou mais series: a cor identifica,
        // mas a identidade nunca pode depender so dela.
        <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {series.map((item, index) => (
            <li key={item.meta.slug} className="flex items-center gap-1.5 text-xs text-ink-2">
              <span
                aria-hidden
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: seriesColor(index) }}
              />
              {item.meta.nome}
            </li>
          ))}
        </ul>
      ) : null}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chartTheme.grid} strokeDasharray="0" vertical={false} />

          <XAxis
            dataKey="data"
            tickFormatter={(value: string) => formatAxisDate(value, frequencia)}
            stroke={chartTheme.axis}
            tick={{ fill: chartTheme.axisLabel, fontSize: 11 }}
            tickLine={false}
            minTickGap={28}
          />

          <YAxis
            stroke={chartTheme.axis}
            tick={{ fill: chartTheme.axisLabel, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => formatNumber(value, casasNoEixo)}
            domain={['auto', 'auto']}
          />

          <Tooltip
            content={<ChartTooltip metaByKey={metaByKey} />}
            cursor={{ stroke: chartTheme.axis, strokeWidth: 1 }}
          />

          {series.map((item, index) => (
            <Line
              key={item.meta.slug}
              type="monotone"
              dataKey={item.meta.slug}
              stroke={seriesColor(index)}
              strokeWidth={2}
              dot={false}
              // Marcador maior que a linha, para o alvo do mouse ser confortavel.
              activeDot={{ r: 4, strokeWidth: 2, stroke: chartTheme.surface }}
              // Series mensais e diarias no mesmo grafico deixam buracos; sem
              // isto a linha se parte em segmentos soltos.
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Junta varias series numa tabela unica indexada por data, para o Recharts. */
function buildRows(series: SeriesDetail[]): {
  rows: MergedRow[];
  metaByKey: Record<string, SeriesMeta>;
} {
  const byDate = new Map<string, MergedRow>();
  const metaByKey: Record<string, SeriesMeta> = {};

  for (const item of series) {
    metaByKey[item.meta.slug] = item.meta;

    for (const point of item.points) {
      const row = byDate.get(point.data) ?? { data: point.data };
      row[item.meta.slug] = point.valor;
      byDate.set(point.data, row);
    }
  }

  const rows = [...byDate.values()].sort((a, b) => a.data.localeCompare(b.data));
  return { rows, metaByKey };
}
