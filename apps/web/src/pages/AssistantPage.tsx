import type { ChatMessage, ToolCallTrace as Trace } from '@bcb/shared';
import { AlertTriangle, Send, ShieldCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { ToolCallTraceList } from '@/components/chat/ToolCallTrace';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAssistantStatus, useChat } from '@/lib/queries';
import { useScreenContext } from '@/lib/screen-context';
import { cn } from '@/lib/utils';

interface Turn extends ChatMessage {
  traces?: Trace[];
  corrigido?: boolean;
}

const SUGESTOES = [
  'Como esta a inflacao?',
  'O dolar subiu ou caiu na ultima semana?',
  'Qual a diferenca entre a meta Selic e a Selic efetiva?',
  'A inadimplencia esta aumentando?',
];

export function AssistantPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const { data: status } = useAssistantStatus();
  const { context } = useScreenContext();
  const chat = useChat();

  const disponivel = status?.availability === 'OK';

  function enviar(mensagem: string) {
    const texto = mensagem.trim();
    if (!texto || chat.isPending || !disponivel) return;

    const historico: ChatMessage[] = turns.map(({ role, content }) => ({ role, content }));
    setTurns((atual) => [...atual, { role: 'user', content: texto }]);
    setInput('');

    chat.mutate(
      { message: texto, history: historico, screenContext: context },
      {
        onSuccess: (resposta) => {
          setTurns((atual) => [
            ...atual,
            {
              role: 'assistant',
              content: resposta.reply,
              traces: resposta.toolCalls,
              corrigido: resposta.groundingCorrected,
            },
          ]);
          requestAnimationFrame(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
          });
        },
        onError: (erro: unknown) => {
          setTurns((atual) => [
            ...atual,
            {
              role: 'assistant',
              content: erro instanceof Error ? erro.message : 'Falha ao consultar o assistente.',
            },
          ]);
        },
      },
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    enviar(input);
  }

  return (
    <AppShell
      title="Assistente"
      description="Perguntas sobre os indicadores, respondidas a partir dos dados sincronizados."
    >
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        {/* O que o assistente esta enxergando -- deixar isso implicito faria a
            resposta parecer adivinhacao. */}
        {context ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="brand">Contexto: {context.pagina}</Badge>
            {context.series.slice(0, 4).map((serie) => (
              <Badge key={serie.slug}>{serie.nome}</Badge>
            ))}
          </div>
        ) : null}

        {!disponivel ? (
          <Card className="mb-4 flex items-start gap-3 p-4">
            <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-ink">Assistente indisponivel</p>
              <p className="mt-1 text-xs text-ink-muted">
                {status?.message ?? 'Verificando o modelo local...'}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                O painel continua funcionando normalmente: apenas a conversa e o resumo automatico
                dependem do modelo local.
              </p>
            </div>
          </Card>
        ) : null}

        <div ref={listRef} className="flex-1 overflow-y-auto">
          {turns.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-ink-muted">Sugestoes:</p>
              {SUGESTOES.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  disabled={!disponivel}
                  onClick={() => enviar(sugestao)}
                  className="w-fit rounded-md border border-hairline bg-surface px-3 py-1.5 text-left text-xs text-ink-2 transition-colors hover:bg-elevated disabled:opacity-50"
                >
                  {sugestao}
                </button>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {turns.map((turn, index) => (
                <li
                  key={index}
                  className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div className={cn('max-w-[85%]', turn.role === 'user' && 'text-right')}>
                    <div
                      className={cn(
                        'rounded-[var(--radius-card)] px-4 py-2.5 text-sm',
                        turn.role === 'user'
                          ? 'bg-primary text-white'
                          : 'border border-hairline bg-surface text-ink',
                      )}
                    >
                      {turn.content}
                    </div>

                    {turn.role === 'assistant' ? (
                      <>
                        {turn.corrigido ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-warning">
                            <ShieldCheck aria-hidden className="h-3 w-3" />
                            A verificacao recusou numeros sem origem nos dados e exigiu nova consulta.
                          </p>
                        ) : null}
                        <ToolCallTraceList traces={turn.traces ?? []} />
                      </>
                    ) : null}
                  </div>
                </li>
              ))}

              {chat.isPending ? (
                <li className="text-xs text-ink-muted animate-pulse-subtle">Consultando os dados...</li>
              ) : null}
            </ul>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={!disponivel || chat.isPending}
            placeholder={disponivel ? 'Pergunte sobre um indicador...' : 'Assistente indisponivel'}
            maxLength={1000}
            className="h-10 flex-1 rounded-md border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-ink-muted disabled:opacity-50"
          />
          <Button type="submit" variant="primary" disabled={!disponivel || chat.isPending}>
            <Send aria-hidden className="h-4 w-4" />
            Enviar
          </Button>
        </form>

        <p className="mt-2 text-[11px] text-ink-muted">
          Todo numero citado e conferido contra as consultas feitas. Respostas com valores sem
          origem sao recusadas pelo sistema.
        </p>
      </div>
    </AppShell>
  );
}
