/**
 * Contratos do assistente.
 *
 * O chat deste painel tem uma regra que atravessa todos estes tipos: o modelo
 * escolhe o que perguntar, mas nao produz numero. Todo valor que aparece numa
 * resposta passou por uma ferramenta -- e o `toolCalls` devolvido junto existe
 * para que a interface possa mostrar isso, em vez de pedir confianca cega.
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Os dados que o usuario esta vendo na tela no momento da pergunta.
 *
 * Enviar isso evita a ida e volta obvia ("qual o IPCA?" com o IPCA na tela) e,
 * mais importante, ancora o assistente no mesmo recorte que o usuario esta
 * lendo. No servidor este bloco entra na conversa como resultado de ferramenta,
 * o que faz seus numeros contarem como fundamentados na checagem de grounding
 * sem abrir excecao na regra.
 */
export interface ScreenContext {
  pagina: string;
  periodoDias: number | null;
  series: Array<{
    codigo: number;
    slug: string;
    nome: string;
    unidade: string;
    valorAtual: number;
    dataAtual: string;
  }>;
}

export interface ChatRequest {
  message: string;
  /** Turnos anteriores. O servidor limita quantos considera. */
  history: ChatMessage[];
  screenContext: ScreenContext | null;
}

/** Registro de uma chamada de ferramenta, exibido sob a resposta. */
export interface ToolCallTrace {
  name: string;
  args: Record<string, unknown>;
  status: 'OK' | 'NO_DATA' | 'ERROR';
  durationMs: number;
  /** Resumo curto do retorno, para a interface mostrar sem despejar JSON. */
  summary: string;
}

export interface ChatResponse {
  reply: string;
  toolCalls: ToolCallTrace[];
  /**
   * `true` quando a checagem de grounding reprovou a resposta e o sistema
   * precisou intervir. A interface sinaliza isso -- esconder seria esconder
   * justamente o caso em que o usuario mais precisa desconfiar.
   */
  groundingCorrected: boolean;
}

export type AssistantAvailability = 'OK' | 'MODEL_MISSING' | 'SERVICE_DOWN';

export interface AssistantStatus {
  availability: AssistantAvailability;
  model: string;
  /** Mensagem pronta para exibicao quando o assistente nao esta disponivel. */
  message: string | null;
}

/** Resumo automatico da Visao Geral. */
export interface NarrativeResponse {
  /** `null` quando o modelo local nao esta disponivel -- a tela segue funcionando. */
  text: string | null;
  unavailableReason: string | null;
  generatedAt: string | null;
}
