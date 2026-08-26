import { ExternalLink } from 'lucide-react';

/**
 * Origem do numero.
 *
 * Cada grafico diz de qual serie do SGS ele saiu e leva ao catalogo oficial.
 * Num painel cuja credibilidade vem da fonte, poder conferir o dado no Banco
 * Central e parte do produto -- nao rodape.
 */
export function SourceBadge({ codigo, nome }: { codigo: number; nome: string }) {
  return (
    <a
      href="https://www3.bcb.gov.br/sgspub"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-[11px] text-ink-muted transition-colors hover:text-primary"
      title={`${nome} -- serie ${codigo} do SGS/Banco Central`}
    >
      Fonte: BCB/SGS <span className="tabular">#{codigo}</span>
      <ExternalLink aria-hidden className="h-3 w-3" />
    </a>
  );
}
