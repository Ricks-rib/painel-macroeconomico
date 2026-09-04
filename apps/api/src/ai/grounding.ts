/**
 * Verificacao de ancoragem.
 *
 * ---------------------------------------------------------------------------
 * O PROBLEMA QUE ISTO RESOLVE
 * ---------------------------------------------------------------------------
 * O modo de falha mais traicoeiro deste tipo de assistente nao e recusar a
 * responder -- e responder com confianca um numero que ele nao consultou. A
 * sequencia tipica:
 *
 *   Usuario: "qual o IPCA do mes?"
 *   Modelo:  chama a ferramenta, responde "0,07%"              [correto]
 *   Usuario: "e no acumulado do ano?"
 *   Modelo:  NAO chama ferramenta e responde "4,1%"            [inventado]
 *
 * O modelo ja tem o assunto no historico, conclui que "sabe" do que se trata e
 * produz um numero plausivel. Instrucao no prompt de sistema mandando consultar
 * antes de responder nao impede isso: prompt e mitigacao, nao mecanismo. Toda
 * regra que precisa valer SEMPRE tem de existir em codigo, fora do alcance do
 * modelo.
 *
 * Num painel de indicadores economicos isso e especialmente grave, porque um
 * numero inventado e indistinguivel de um correto para quem pergunta -- e a
 * pessoa esta ali justamente porque nao sabe o valor.
 *
 * ---------------------------------------------------------------------------
 * COMO FUNCIONA
 * ---------------------------------------------------------------------------
 * Reune todo numero que apareceu no retorno das ferramentas neste turno e
 * confere contra todo numero presente na resposta. Numero na resposta sem
 * origem em ferramenta e, por definicao, inventado.
 *
 * Toleram-se inteiros de 0 a 12 (que aparecem como linguagem: "os tres
 * indicadores", "nos ultimos 12 meses") e arredondamentos de um valor
 * permitido, porque reformular numero e trabalho legitimo de redacao.
 */

export interface GroundingCheck {
  ok: boolean;
  /** Numeros presentes na resposta sem origem em nenhuma ferramenta. */
  unsupported: string[];
}

/**
 * Captura um numero inteiro, com todos os seus separadores.
 *
 * Precisa casar `1.167.869` de uma vez. Um padrao que parasse no primeiro
 * separador leria isso como "1.167" e "869" -- dois numeros que nao existem em
 * lugar nenhum -- e reprovaria como invencao uma resposta perfeitamente
 * correta sobre o PIB. Foi o que aconteceu no primeiro teste.
 */
const NUMBER_TOKEN = /-?\d+(?:[.,]\d+)*/g;

/**
 * Interpreta um numero escrito em qualquer uma das duas convencoes.
 *
 * O modelo escreve em portugues (`1.167.869,45`), enquanto os dados chegam da
 * API em formato ingles (`5.1506`). Distinguir "separador de milhar" de
 * "separador decimal" exige olhar o agrupamento: tres digitos apos o separador,
 * repetidos, so ocorrem em milhar.
 */
function parseNumericToken(raw: string): number {
  const ptBrGrouped = /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/;
  const enUsGrouped = /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;

  if (ptBrGrouped.test(raw)) return Number(raw.replace(/\./g, '').replace(',', '.'));
  if (enUsGrouped.test(raw)) return Number(raw.replace(/,/g, ''));

  return Number(raw.replace(',', '.'));
}

/** Extrai numeros de qualquer estrutura, recursivamente. */
export function collectNumbers(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (value === null || value === undefined) return into;

  if (typeof value === 'number') {
    addWithRoundings(into, value);
    return into;
  }

  if (typeof value === 'string') {
    for (const match of value.matchAll(NUMBER_TOKEN)) {
      const parsed = parseNumericToken(match[0]);
      if (Number.isFinite(parsed)) addWithRoundings(into, parsed);
    }
    return into;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, into);
    return into;
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value)) collectNumbers(item, into);
    return into;
  }

  return into;
}

/**
 * Registra o valor, suas formas arredondadas e o seu modulo.
 *
 * ARREDONDAMENTO DE DUAS CASAS: a cotacao do cambio vem com quatro casas
 * (5,1512) e qualquer pessoa a escreve com duas ("R$ 5,15"). Sem essa
 * tolerancia a redacao mais natural possivel seria reprovada como invencao.
 *
 * MODULO: em portugues o sentido da variacao vai na palavra, nao no sinal --
 * "queda de 0,22%" e a forma correta de dizer -0,22%. Sem aceitar o modulo, o
 * verificador reprovava toda queda corretamente relatada, e o mesmo acontecia
 * com dias do mes: a data ISO 2026-08-24 deixa "-24" no conjunto, mas o texto
 * diz "24 de agosto". Ambos foram observados em teste.
 *
 * O que se perde: um erro de sinal deixa de ser detectado. E um preco baixo --
 * a direcao esta escrita por extenso ao lado, onde uma pessoa a confere sem
 * esforco, enquanto um numero inventado nao tem como ser conferido.
 */
function addWithRoundings(into: Set<string>, value: number): void {
  addRoundings(into, value);
  if (value < 0) addRoundings(into, Math.abs(value));
}

function addRoundings(into: Set<string>, value: number): void {
  into.add(normalize(value));
  into.add(normalize(Math.round(value)));
  into.add(normalize(Math.floor(value)));
  into.add(normalize(Math.ceil(value)));
  into.add(normalize(Math.round(value * 10) / 10));
  into.add(normalize(Math.round(value * 100) / 100));
}

function normalize(value: number): string {
  return String(Number(value.toFixed(4)));
}

/** Numeros pequenos usados como linguagem, nao como medicao. */
const LANGUAGE_NUMBERS = new Set(Array.from({ length: 13 }, (_, index) => String(index)));

/**
 * O numero vem com unidade colada?
 *
 * A tolerancia de numero-como-linguagem existe para "os tres indicadores" e
 * "nos ultimos 12 meses". Ela abria um buraco: qualquer afirmacao numerica
 * com valor pequeno passava sem origem.
 *
 * Foi observado ao gravar a demonstracao. Perguntado se a inflacao estava
 * alta, o modelo respondeu que ela "esta abaixo da meta do Banco Central,
 * que geralmente e de 3% a 5% ao ano". A meta e 3,00% com tolerancia de
 * 1,5 p.p. -- a faixa e 1,5% a 4,5%, e o IPCA de 4,44% nao esta abaixo
 * dela. Duas afirmacoes erradas, ambas aprovadas porque 3 e 5 sao menores
 * que 12.
 *
 * A distincao que faltava: numero com unidade e MEDICAO, e medicao precisa
 * de origem, por menor que seja. Sem unidade, continua podendo ser
 * linguagem.
 */
const MEDIDA_DEPOIS = /^\s*(%|p\.?\s?p\.?\b|pontos? percentuais?)/i;
const MEDIDA_ANTES = /(R\$|US\$)\s*$/;

function pareceMedicao(reply: string, inicio: number, raw: string): boolean {
  return (
    MEDIDA_DEPOIS.test(reply.slice(inicio + raw.length, inicio + raw.length + 22)) ||
    MEDIDA_ANTES.test(reply.slice(Math.max(0, inicio - 5), inicio))
  );
}

export function checkGrounding(reply: string, allowed: Set<string>): GroundingCheck {
  const unsupported: string[] = [];

  for (const match of reply.matchAll(NUMBER_TOKEN)) {
    const raw = match[0];
    const parsed = parseNumericToken(raw);
    if (!Number.isFinite(parsed)) continue;

    const key = normalize(parsed);
    if (allowed.has(key)) continue;
    if (LANGUAGE_NUMBERS.has(key) && !pareceMedicao(reply, match.index, raw)) continue;

    unsupported.push(raw);
  }

  return { ok: unsupported.length === 0, unsupported };
}
