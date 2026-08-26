import type { SeriesPoint } from '@bcb/shared';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { seriesColor } from './theme';

/**
 * Linha de tendencia miniatura do cartao de indicador.
 *
 * Sem eixos, sem grade, sem tooltip: nao e um grafico para ler valor, e para
 * dar forma ao numero que esta ao lado. O dominio segue os dados (nao comeca
 * no zero) porque o que interessa aqui e o formato da variacao recente, e uma
 * base fixa achataria justamente isso.
 */
export function Sparkline({ points, height = 40 }: { points: SeriesPoint[]; height?: number }) {
  if (points.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line
          type="monotone"
          dataKey="valor"
          stroke={seriesColor(0)}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
