import type {
  AssistantStatus,
  ChatRequest,
  ChatResponse,
  NarrativeResponse,
  ToolCallTrace,
} from '@bcb/shared';
import {
  buildScreenContextMessage,
  buildSystemPrompt,
  SCREEN_CONTEXT_TOOL_NAME,
} from '../../ai/context.js';
import { checkGrounding, collectNumbers } from '../../ai/grounding.js';
import { chat, checkAvailability, LlmUnavailableError, type ChatMessage } from '../../ai/ollama.js';
import { findTool, TOOL_DEFINITIONS } from '../../ai/tools.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../lib/logger.js';

/**
 * O laco de conversa com ferramentas.
 *
 * Limites deliberados: poucas voltas e historico curto. Um assistente que
 * encadeia dez chamadas para responder uma pergunta simples nao esta sendo
 * cuidadoso -- esta perdido, e o custo disso aparece como espera para quem
 * perguntou.
 */
const MAX_ITERATIONS = 4;
const MAX_HISTORY_TURNS = 8;

export async function getStatus(): Promise<AssistantStatus> {
  const availability = await checkAvailability();
  return {
    availability: availability.kind,
    model: availability.model,
    message: availability.reason ?? null,
  };
}

export async function runChat(request: ChatRequest): Promise<ChatResponse> {
  const availability = await checkAvailability();
  if (!availability.available) {
    throw new AppError(503, 'LLM_UNAVAILABLE', availability.reason ?? 'Assistente indisponivel.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(request.screenContext !== null) },
  ];

  // Numeros considerados fundamentados neste turno.
  const grounded = new Set<string>();

  const screenMessage = buildScreenContextMessage(request.screenContext);
  if (screenMessage) {
    messages.push(screenMessage);
    collectNumbers(JSON.parse(screenMessage.content), grounded);
  }

  for (const turn of request.history.slice(-MAX_HISTORY_TURNS)) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: 'user', content: request.message });

  const traces: ToolCallTrace[] = [];
  let groundingCorrected = false;
  let reply = '';

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    const result = await chat({ messages, tools: TOOL_DEFINITIONS });

    if (result.toolCalls.length > 0) {
      messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });

      for (const call of result.toolCalls) {
        const trace = await executeTool(call.function.name, call.function.arguments, grounded);
        traces.push(trace.trace);
        messages.push({
          role: 'tool',
          tool_name: call.function.name,
          content: trace.content,
        });
      }

      continue;
    }

    reply = result.content;

    const check = checkGrounding(reply, grounded);
    if (check.ok) {
      return { reply, toolCalls: traces, groundingCorrected };
    }

    logger.warn('resposta reprovada na ancoragem', {
      numeros: check.unsupported.join(', '),
      tentativa: iteration + 1,
      // Sem o texto, o numero sozinho nao diz se foi invencao ou uso do
      // numero como linguagem ("nas ultimas 24 horas"). Os dois exigem
      // correcoes opostas, e distinguir um do outro sem ver a frase e
      // adivinhacao.
      trecho: reply.slice(0, 220).replace(/\s+/g, ' '),
    });

    if (groundingCorrected) {
      // Ja houve uma correcao e o modelo reincidiu. Admitir e melhor que
      // entregar um numero sem origem.
      return {
        reply:
          'Nao consegui confirmar os numeros necessarios para responder isso com seguranca. Reformule a pergunta ou consulte o indicador diretamente no painel.',
        toolCalls: traces,
        groundingCorrected: true,
      };
    }

    groundingCorrected = true;
    messages.push({ role: 'assistant', content: reply });
    messages.push({
      role: 'user',
      content:
        `Os valores ${check.unsupported.join(', ')} nao vieram de nenhuma consulta. ` +
        'Chame as ferramentas necessarias e responda usando somente os numeros devolvidos por elas.',
    });
  }

  // Estourou as voltas sem uma resposta final aprovada.
  return {
    reply:
      reply ||
      'Nao consegui completar a consulta necessaria para responder. Tente uma pergunta mais especifica.',
    toolCalls: traces,
    groundingCorrected,
  };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  grounded: Set<string>,
): Promise<{ trace: ToolCallTrace; content: string }> {
  const startedAt = Date.now();
  const tool = findTool(name);

  if (!tool) {
    // O modelo inventou uma ferramenta. Devolver isso como conteudo (em vez de
    // lancar) deixa ele se corrigir na proxima volta.
    return {
      trace: {
        name,
        args,
        status: 'ERROR',
        durationMs: Date.now() - startedAt,
        summary: `Ferramenta inexistente: ${name}.`,
      },
      content: JSON.stringify({ erro: `Ferramenta "${name}" nao existe.` }),
    };
  }

  try {
    const result = await tool.execute(args);

    // Só o que voltou de ferramenta entra no conjunto de numeros permitidos.
    collectNumbers(result.data, grounded);

    return {
      trace: {
        name,
        args,
        status: result.status,
        durationMs: Date.now() - startedAt,
        summary: result.summary,
      },
      content: JSON.stringify(result.data),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('ferramenta falhou', { name, error: message });

    return {
      trace: {
        name,
        args,
        status: 'ERROR',
        durationMs: Date.now() - startedAt,
        summary: `Falha ao consultar: ${message}`,
      },
      content: JSON.stringify({ erro: message }),
    };
  }
}

/**
 * Resumo automatico da Visao Geral.
 *
 * Mesma disciplina do chat: o texto e produzido a partir de um retorno de
 * ferramenta e passa pela checagem de ancoragem. Reprovou, nao publica -- um
 * cartao vazio e melhor que um cartao com numero inventado logo na abertura do
 * painel.
 */
export async function getNarrative(): Promise<NarrativeResponse> {
  const availability = await checkAvailability();
  if (!availability.available) {
    return {
      text: null,
      unavailableReason: availability.reason ?? 'Assistente indisponivel.',
      generatedAt: null,
    };
  }

  const tool = findTool('buscar_resumo_macro');
  if (!tool) throw new Error('ferramenta de resumo ausente');

  const snapshot = await tool.execute({});
  if (snapshot.status !== 'OK') {
    return {
      text: null,
      unavailableReason: 'Ainda nao ha dados sincronizados suficientes para um resumo.',
      generatedAt: null,
    };
  }

  const grounded = collectNumbers(snapshot.data);

  try {
    const result = await chat({
      temperature: 0.1,
      maxTokens: 320,
      messages: [
        {
          role: 'system',
          content: [
            'Voce redige o resumo de abertura de um painel de indicadores macroeconomicos brasileiros.',
            'Escreva um unico paragrafo de no maximo quatro frases, em portugues do Brasil.',
            'Use somente os numeros do bloco de dados fornecido. Nao acrescente nenhum outro numero.',
            'Nao faca previsao e nao de recomendacao de investimento.',
            'Indicadores percentuais variam em pontos percentuais; indicadores de nivel variam em porcentagem.',
          ].join('\n'),
        },
        { role: 'user', content: JSON.stringify(snapshot.data) },
      ],
    });

    const check = checkGrounding(result.content, grounded);
    if (!check.ok) {
      logger.warn('resumo automatico reprovado na ancoragem', {
        numeros: check.unsupported.join(', '),
      });
      return {
        text: null,
        unavailableReason:
          'O resumo gerado citou numeros que nao constam nos dados e foi descartado.',
        generatedAt: null,
      };
    }

    return {
      text: result.content,
      unavailableReason: null,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof LlmUnavailableError) {
      return { text: null, unavailableReason: error.message, generatedAt: null };
    }
    throw error;
  }
}
