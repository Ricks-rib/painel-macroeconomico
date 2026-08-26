import type { SeriesSummary } from '@bcb/shared';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';
import { Card } from '@/components/ui/card';
import { formatChange, formatDate, formatValue } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Cartao de indicador.
 *
 * A REGRA DE POLARIDADE VIVE NO DADO, NAO AQUI. Cada serie carrega no catalogo
 * se subir e bom, ruim ou nenhum dos dois, e o cartao apenas obedece:
 *
 *   IPCA subindo      -> ruim   (vermelho)
 *   PIB subindo       -> bom    (verde)
 *   Selic subindo     -> nem um nem outro (azul institucional)
 *   Dolar subindo     -> nem um nem outro
 *
 * Os dois ultimos sao o ponto. Alta do dolar beneficia exportador e penaliza
 * importador; alta da Selic e decisao de politica monetaria, nao noticia boa ou
 * ruim em si. Pintar isso de verde ou vermelho seria o painel emitindo um
 * juizo que o dado nao sustenta -- e num painel que precisa passar seriedade,
 * esse tipo de exagero e exatamente o que corroi a confianca.
 *
 * A direcao tambem nunca depende so da cor: vai uma seta e o numero com sinal.
 */
export function KpiCard({ summary, compact = false }: { summary: SeriesSummary; compact?: boolean }) {
  const { meta, latest, change } = summary;
  const changeLabel = formatChange(change);

  const direction = change?.primary === null || change === null ? 0 : Math.sign(change.primary);
  const tone = toneFor(meta.betterWhen, direction);
  const Icon = direction > 0 ? ArrowUpRight : direction < 0 ? ArrowDownRight : ArrowRight;

  return (
    <Card className="flex flex-col justify-between p-4">
      <div>
        <p className="text-xs font-medium text-ink-muted">{meta.nome}</p>

        {latest ? (
          <p className="mt-1 text-2xl font-semibold text-ink">{formatValue(latest.valor, meta)}</p>
        ) : (
          <p className="mt-1 text-2xl font-semibold text-ink-muted">--</p>
        )}

        {changeLabel ? (
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium tabular', tone)}>
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {changeLabel}
            <span className="font-normal text-ink-muted">vs. leitura anterior</span>
          </p>
        ) : null}
      </div>

      {!compact && summary.sparkline.length > 1 ? (
        <div className="mt-3">
          <Sparkline points={summary.sparkline} />
        </div>
      ) : null}

      {latest ? (
        <p className="mt-2 text-[11px] text-ink-muted tabular">{formatDate(latest.data)}</p>
      ) : null}
    </Card>
  );
}

function toneFor(betterWhen: SeriesSummary['meta']['betterWhen'], direction: number): string {
  if (direction === 0 || betterWhen === 'NEUTRAL') return 'text-primary';

  const isGood = betterWhen === 'HIGHER' ? direction > 0 : direction < 0;
  return isGood ? 'text-good' : 'text-critical';
}
