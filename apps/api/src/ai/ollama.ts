import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Cliente do Ollama (LLM local).
 *
 * POR QUE LOCAL: o dado nunca sai da maquina. Aqui os dados sao publicos, o
 * que torna a escolha menos obvia -- mas a arquitetura e a mesma que um painel
 * com dado sensivel exigiria, e essa e a questao. Trocar por uma API de
 * terceiro seria mudar uma URL; o contrario, depois de construido em cima de
 * uma nuvem, nao e.
 *
 * REGRA DE OURO DESTE MODULO: toda falha e recuperavel do ponto de vista do
 * chamador. O modelo pode estar fora, pode nao estar baixado, pode demorar
 * demais. Nada disso pode derrubar um endpoint -- porque nenhuma funcionalidade
 * essencial depende do LLM. Ele narra e conversa; ele nao calcula.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Preenchido em mensagens de resposta de ferramenta. */
  tool_name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

/** Definicao de ferramenta no formato aceito pelo Ollama (compativel OpenAI). */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  model: string;
  latencyMs: number;
}

export class LlmUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    // `cause` e propriedade nativa de Error desde o ES2022; declara-la como
    // parametro de propriedade sombrearia a nativa em vez de preenche-la.
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'LlmUnavailableError';
  }
}

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Mantem o modelo residente na VRAM entre chamadas.
 *
 * Sem isto o Ollama descarrega o modelo apos alguns minutos de ociosidade, e a
 * proxima chamada paga de novo o carregamento de varios gigabytes. Num modelo
 * de 14B isso custa dezenas de segundos -- e atinge sempre a PRIMEIRA pergunta,
 * ou seja, a primeira impressao de quem abre o assistente.
 */
const KEEP_ALIVE = '10m';

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  /**
   * Temperatura baixa por padrao. O modelo aqui reformula fatos que ja
   * recebeu; criatividade nao e util e aumenta a chance de ele "melhorar" um
   * numero.
   */
  temperature?: number;
  timeoutMs?: number;
  maxTokens?: number;
}

export async function chat(options: ChatOptions): Promise<ChatResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages: options.messages,
        ...(options.tools ? { tools: options.tools } : {}),
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: {
          temperature: options.temperature ?? 0.2,
          // Semente fixa: a mesma pergunta com o mesmo historico devolve a
          // mesma resposta. Ver a nota em `OLLAMA_SEED`.
          seed: env.OLLAMA_SEED,
          ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new LlmUnavailableError(`Ollama respondeu ${response.status}. ${body.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      model?: string;
      message?: { content?: string; tool_calls?: ToolCall[] };
    };

    return {
      content: payload.message?.content?.trim() ?? '',
      toolCalls: payload.message?.tool_calls ?? [],
      model: payload.model ?? env.OLLAMA_MODEL,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof LlmUnavailableError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LlmUnavailableError(
        `O modelo nao respondeu em ${(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s.`,
      );
    }

    throw new LlmUnavailableError(
      `Nao foi possivel falar com o Ollama em ${env.OLLAMA_BASE_URL}. O servico esta rodando?`,
      error,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------

export interface AvailabilityState {
  available: boolean;
  model: string;
  /** Distingue "servico fora" de "modelo nao baixado". */
  kind: 'OK' | 'MODEL_MISSING' | 'SERVICE_DOWN';
  reason?: string;
  checkedAt: number;
}

let cachedAvailability: AvailabilityState | null = null;

/** Um minuto: curto o bastante para notar o Ollama subindo, longo o bastante
 *  para nao consultar a cada requisicao. */
const AVAILABILITY_TTL_MS = 60_000;

/**
 * Verifica se o modelo configurado esta disponivel.
 *
 * Distingue tres situacoes que geram mensagens diferentes para o usuario:
 * servico fora do ar, servico no ar mas modelo nao baixado, e tudo certo.
 * "IA indisponivel" sem essa distincao manda a pessoa investigar as cegas.
 */
export async function checkAvailability(force = false): Promise<AvailabilityState> {
  const now = Date.now();
  if (!force && cachedAvailability && now - cachedAvailability.checkedAt < AVAILABILITY_TTL_MS) {
    return cachedAvailability;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as { models?: Array<{ name?: string }> };
    const installed = (payload.models ?? []).map((model) => model.name ?? '');

    // O Ollama nomeia como "modelo:tag"; aceitar o prefixo evita falso negativo
    // quando a configuracao omite a tag.
    const found = installed.some(
      (name) => name === env.OLLAMA_MODEL || name.startsWith(`${env.OLLAMA_MODEL}:`),
    );

    cachedAvailability = found
      ? { available: true, kind: 'OK', model: env.OLLAMA_MODEL, checkedAt: now }
      : {
          available: false,
          kind: 'MODEL_MISSING',
          model: env.OLLAMA_MODEL,
          reason: `O Ollama esta rodando, mas o modelo "${env.OLLAMA_MODEL}" nao esta baixado. Rode: ollama pull ${env.OLLAMA_MODEL}`,
          checkedAt: now,
        };
  } catch (error) {
    cachedAvailability = {
      available: false,
      kind: 'SERVICE_DOWN',
      model: env.OLLAMA_MODEL,
      reason: `Ollama indisponivel em ${env.OLLAMA_BASE_URL}. Verifique se o servico esta rodando.`,
      checkedAt: now,
    };
    logger.debug('ollama indisponivel', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }

  return cachedAvailability;
}

/**
 * Carrega o modelo na VRAM sem gerar nada.
 *
 * Disparado no boot da API, sem bloquear. `num_predict: 0` pede zero tokens: o
 * efeito util e apenas o carregamento.
 */
export async function warmUp(): Promise<void> {
  const availability = await checkAvailability(true);
  if (!availability.available) {
    logger.info('assistente indisponivel no boot', { motivo: availability.reason });
    return;
  }

  const startedAt = Date.now();

  try {
    await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages: [{ role: 'user', content: 'ok' }],
        stream: false,
        keep_alive: KEEP_ALIVE,
        options: { num_predict: 0 },
      }),
    });

    logger.info('modelo carregado na memoria', {
      modelo: env.OLLAMA_MODEL,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    // Falhar aqui e inofensivo: a proxima chamada real carrega o modelo.
    logger.debug('warm-up do modelo falhou', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
