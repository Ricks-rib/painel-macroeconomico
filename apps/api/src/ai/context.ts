import type { ScreenContext } from '@bcb/shared';
import { todayIso } from '../lib/dates.js';
import type { ChatMessage } from './ollama.js';

/**
 * Contexto da tela e prompt de sistema.
 *
 * ---------------------------------------------------------------------------
 * POR QUE O CONTEXTO DA TELA ENTRA COMO RESULTADO DE FERRAMENTA
 * ---------------------------------------------------------------------------
 * O usuario pergunta olhando para um grafico. Obrigar o modelo a consultar de
 * novo o numero que esta na tela e uma ida e volta inutil -- mas simplesmente
 * colar esses valores no prompt criaria um buraco na checagem de ancoragem:
 * ela so considera fundamentado o que passou por ferramenta, entao o modelo
 * poderia repetir um numero da tela e ser acusado de invencao.
 *
 * A saida e nao abrir excecao: o bloco de contexto entra na conversa como se
 * fosse o retorno de uma ferramenta chamada `contexto_da_tela`. Com isso os
 * numeros visiveis passam pelo mesmo caminho que os demais, sao coletados pela
 * mesma funcao e contam como fundamentados pela mesma regra. Nenhuma garantia
 * foi enfraquecida; apenas mais uma origem legitima foi declarada como tal.
 */

export const SCREEN_CONTEXT_TOOL_NAME = 'contexto_da_tela';

export function buildSystemPrompt(hasScreenContext: boolean): string {
  const lines = [
    'Voce e o assistente de um painel de indicadores macroeconomicos brasileiros.',
    `A data de hoje e ${todayIso()}.`,
    'Os dados vem do SGS, o sistema de series temporais do Banco Central do Brasil.',
    '',
    'REGRAS INEGOCIAVEIS:',
    '1. Todo numero que voce escrever precisa ter vindo de uma ferramenta ou do contexto da tela. Nunca estime, nunca complete de memoria, nunca calcule de cabeca.',
    '2. Para saber qualquer valor, chame a ferramenta correspondente -- mesmo que o assunto ja tenha aparecido na conversa.',
    '3. Nunca calcule variacoes voce mesmo. As ferramentas ja devolvem a variacao calculada, com a unidade correta.',
    '4. Se a ferramenta nao trouxer o dado, diga que nao tem a informacao. Nao ha resposta pior que um numero inventado num painel economico.',
    '',
    'PERGUNTA CONCEITUAL E PERGUNTA DE VALOR SAO DIFERENTES:',
    '- "O que e inflacao?" pergunta o conceito. Responda o conceito primeiro, em uma ou duas frases, e diga qual indicador do painel o mede. So depois traga o valor atual, se ajudar.',
    '- "Qual o IPCA?" pergunta o valor. Chame a ferramenta e responda o numero.',
    '- Nunca responda uma pergunta conceitual apenas com um numero. Quem perguntou o que uma coisa e nao perguntou quanto ela esta.',
    '- Nao confunda o conceito com o indicador que o mede nem com a periodicidade: inflacao e o fenomeno, o IPCA e o indice oficial que a mede, e a leitura mensal e um recorte dele.',
    '',
    'SOBRE COMPARAR COM REFERENCIAS:',
    '- Nao compare um indicador com meta, banda ou valor de referencia que nao tenha vindo de ferramenta. O painel nao tem a meta de inflacao; dizer qual e seria afirmar de memoria.',
    '- Cada numero tem de manter o nome do indicador de onde veio. A meta Selic e taxa de juros, nao meta de inflacao; o CDI nao e a Selic. Trocar o rotulo de um numero e tao errado quanto inventar o numero.',
    '- Sem referencia disponivel, diga o que o dado mostra -- a direcao e o tamanho da variacao -- e pare ai.',
    '',
    'SOBRE UNIDADES:',
    '- Indicadores que ja sao percentuais (IPCA, Selic, inadimplencia) variam em PONTOS PERCENTUAIS (p.p.), nao em porcentagem.',
    '- Indicadores de nivel (cambio, PIB, saldo de credito) variam em porcentagem.',
    '- Respeite a unidade que a ferramenta devolveu em "unidadeDaVariacao".',
    '',
    'TOM: objetivo e sobrio. Explique o que o numero significa quando ajudar, mas nao de conselho de investimento e nao faca previsao.',
    'Responda em portugues do Brasil, em no maximo dois paragrafos curtos.',
  ];

  if (hasScreenContext) {
    lines.push(
      '',
      `Voce recebeu um retorno da ferramenta ${SCREEN_CONTEXT_TOOL_NAME} com os dados que o usuario esta vendo agora.`,
      'Pode usar esses numeros diretamente. Para qualquer dado fora desse recorte -- outro periodo, outro indicador, outra data -- chame a ferramenta apropriada em vez de extrapolar.',
    );
  }

  return lines.join('\n');
}

/**
 * Converte o recorte da tela numa mensagem de retorno de ferramenta.
 *
 * Devolve `null` quando nao ha contexto, para o chamador simplesmente nao
 * incluir a mensagem.
 */
export function buildScreenContextMessage(context: ScreenContext | null): ChatMessage | null {
  if (!context || context.series.length === 0) return null;

  const payload = {
    pagina: context.pagina,
    janelaDias: context.periodoDias,
    indicadoresVisiveis: context.series.map((serie) => ({
      indicador: serie.nome,
      serie: serie.slug,
      valor: serie.valorAtual,
      unidade: serie.unidade,
      data: serie.dataAtual,
    })),
  };

  return {
    role: 'tool',
    tool_name: SCREEN_CONTEXT_TOOL_NAME,
    content: JSON.stringify(payload),
  };
}
