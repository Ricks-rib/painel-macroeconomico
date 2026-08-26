import {
  CATEGORY_LABELS,
  SERIES_CATEGORIES,
  VERIFIED_SERIES,
  changeFromPrevious,
  changeOverWindow,
  extremes,
  findSeriesBySlug,
  HEADLINE_SLUGS,
  latestPoint,
  sliceLastDays,
  type SeriesCategory,
  type SeriesDefinition,
  type SeriesPoint,
} from '@bcb/shared';
import { z } from 'zod';
import { getLastPoints, getPoints } from '../modules/series/series.repo.js';
import type { ToolDefinition } from './ollama.js';

/**
 * As ferramentas do assistente.
 *
 * PRINCIPIO: o modelo escolhe O QUE perguntar; ele nunca decide COMO a
 * consulta e feita nem produz o numero. Cada ferramenta tem parametros tipados
 * e uma consulta ja escrita -- nao existe caminho em que o modelo gere SQL ou
 * escolha uma tabela.
 *
 * Uma diferenca em relacao a um painel com dado privado: aqui nao ha
 * `usuario_id` injetado pelo servidor, porque dado macroeconomico e publico e
 * nao existe "dono do dado" a proteger. O que permanece e a outra metade da
 * regra -- superficie de consulta fechada -- e essa vale por si.
 *
 * TODA CONTA SAI DE `@bcb/shared/metrics`. O modelo recebe a variacao ja
 * calculada. Pedir a um LLM que calcule variacao percentual e criar um segundo
 * numero possivel para a mesma pergunta.
 */

export interface ToolResult {
  status: 'OK' | 'NO_DATA' | 'ERROR';
  /** Frase curta para a interface exibir sob a resposta, sem despejar JSON. */
  summary: string;
  data: unknown;
}

export interface Tool {
  name: string;
  definition: ToolDefinition;
  execute(rawArgs: unknown): Promise<ToolResult>;
}

const slugs = VERIFIED_SERIES.map((s) => s.slug);

/** Descreve um ponto com unidade e data, para o modelo nao precisar inferir nada. */
function describePoint(definition: SeriesDefinition, point: SeriesPoint) {
  return {
    valor: point.valor,
    unidade: definition.unidade,
    data: point.data,
  };
}

function noData(nome: string): ToolResult {
  return {
    status: 'NO_DATA',
    summary: `Sem dados sincronizados para ${nome}.`,
    data: { aviso: `Nao ha dados locais para ${nome}.` },
  };
}

/**
 * Serializa a variacao ja calculada, com a unidade correta.
 *
 * `p.p.` para series que ja sao percentuais e `%` para series de nivel -- a
 * distincao vem do catalogo, nao de um palpite do modelo. Dizer que o IPCA
 * "caiu 56%" ao ir de 0,16 para 0,07 e verdadeiro e inutil; "caiu 0,09 p.p." e
 * o que um economista diria.
 *
 * UM NUMERO SO POR CONCEITO. A primeira versao devolvia tambem a diferenca
 * absoluta, e o modelo prontamente trocou uma pela outra: anunciou o dolar
 * "variando -1,13%" quando -0,0113 era a diferenca em reais e -0,22% a
 * variacao real. Oferecer duas grandezas parecidas para a mesma pergunta e
 * convidar a confusao -- a checagem de ancoragem pegou, mas a correcao certa e
 * nao criar a ambiguidade. Quem precisa das duas leituras e a interface, que
 * tem espaco para rotular cada uma.
 */
function describeChange(
  definition: SeriesDefinition,
  change: ReturnType<typeof changeFromPrevious>,
) {
  if (!change || change.primary === null) return null;

  return {
    // Arredondado: o ruido de ponto flutuante (-0.1999999999999993) so serve
    // para o modelo reproduzir uma precisao que o dado nao tem.
    variacao: Number(change.primary.toFixed(4)),
    unidadeDaVariacao: change.primaryUnit === 'PP' ? 'pontos percentuais' : '%',
  };
}

// ---------------------------------------------------------------------------

const serieArg = {
  type: 'string',
  description: `Identificador da serie. Valores aceitos: ${slugs.join(', ')}.`,
  enum: slugs,
};

const buscarSerieAtual: Tool = {
  name: 'buscar_serie_atual',
  definition: {
    type: 'function',
    function: {
      name: 'buscar_serie_atual',
      description:
        'Valor mais recente de um indicador economico, com a data e a variacao em relacao a leitura anterior.',
      parameters: {
        type: 'object',
        properties: { serie: serieArg },
        required: ['serie'],
      },
    },
  },
  async execute(rawArgs) {
    const { serie } = z.object({ serie: z.string() }).parse(rawArgs);
    const definition = findSeriesBySlug(serie);
    if (!definition) {
      return { status: 'ERROR', summary: `Serie desconhecida: ${serie}.`, data: { seriesValidas: slugs } };
    }

    const points = await getLastPoints(definition.codigo, 2);
    const latest = latestPoint(points);
    if (!latest) return noData(definition.nome);

    return {
      status: 'OK',
      summary: `${definition.nome}: ${latest.valor} ${definition.unidade} em ${latest.data}.`,
      data: {
        indicador: definition.nome,
        ...describePoint(definition, latest),
        variacaoDesdeLeituraAnterior: describeChange(
          definition,
          changeFromPrevious(points, definition.compareAs),
        ),
      },
    };
  },
};

const buscarVariacaoPeriodo: Tool = {
  name: 'buscar_variacao_periodo',
  definition: {
    type: 'function',
    function: {
      name: 'buscar_variacao_periodo',
      description:
        'Variacao de um indicador ao longo de um periodo, com valor inicial, final, minimo e maximo. Use para perguntas do tipo "quanto subiu nos ultimos 90 dias".',
      parameters: {
        type: 'object',
        properties: {
          serie: serieArg,
          dias: { type: 'number', description: 'Tamanho da janela em dias corridos. Entre 7 e 1825.' },
        },
        required: ['serie', 'dias'],
      },
    },
  },
  async execute(rawArgs) {
    const { serie, dias } = z
      .object({ serie: z.string(), dias: z.coerce.number().int().min(7).max(1825) })
      .parse(rawArgs);

    const definition = findSeriesBySlug(serie);
    if (!definition) {
      return { status: 'ERROR', summary: `Serie desconhecida: ${serie}.`, data: { seriesValidas: slugs } };
    }

    const windowed = sliceLastDays(await getPoints(definition.codigo), dias);
    if (windowed.length === 0) return noData(definition.nome);

    const bounds = extremes(windowed);
    const first = windowed[0];
    const last = windowed[windowed.length - 1];

    return {
      status: 'OK',
      summary: `${definition.nome}: ${windowed.length} leituras nos ultimos ${dias} dias.`,
      data: {
        indicador: definition.nome,
        unidade: definition.unidade,
        janelaDias: dias,
        leituras: windowed.length,
        inicio: first ? { valor: first.valor, data: first.data } : null,
        fim: last ? { valor: last.valor, data: last.data } : null,
        variacaoNoPeriodo: describeChange(
          definition,
          changeOverWindow(windowed, definition.compareAs),
        ),
        minimo: bounds ? { valor: bounds.min.valor, data: bounds.min.data } : null,
        maximo: bounds ? { valor: bounds.max.valor, data: bounds.max.data } : null,
      },
    };
  },
};

const buscarHistoricoSerie: Tool = {
  name: 'buscar_historico_serie',
  definition: {
    type: 'function',
    function: {
      name: 'buscar_historico_serie',
      description:
        'Lista as leituras mais recentes de um indicador, para descrever a trajetoria. Prefira buscar_variacao_periodo quando a pergunta for sobre quanto variou.',
      parameters: {
        type: 'object',
        properties: {
          serie: serieArg,
          limite: { type: 'number', description: 'Quantas leituras devolver (1 a 24).' },
        },
        required: ['serie'],
      },
    },
  },
  async execute(rawArgs) {
    const { serie, limite } = z
      .object({ serie: z.string(), limite: z.coerce.number().int().min(1).max(24).default(12) })
      .parse(rawArgs);

    const definition = findSeriesBySlug(serie);
    if (!definition) {
      return { status: 'ERROR', summary: `Serie desconhecida: ${serie}.`, data: { seriesValidas: slugs } };
    }

    const points = await getLastPoints(definition.codigo, limite);
    if (points.length === 0) return noData(definition.nome);

    return {
      status: 'OK',
      summary: `${definition.nome}: ultimas ${points.length} leituras.`,
      data: {
        indicador: definition.nome,
        unidade: definition.unidade,
        leituras: points.map((point) => ({ data: point.data, valor: point.valor })),
      },
    };
  },
};

const buscarContextoCategoria: Tool = {
  name: 'buscar_contexto_categoria',
  definition: {
    type: 'function',
    function: {
      name: 'buscar_contexto_categoria',
      description:
        'Valor atual de todos os indicadores de uma area. Use para perguntas amplas como "como esta a inflacao" ou "e o cambio".',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Area economica.',
            enum: [...SERIES_CATEGORIES],
          },
        },
        required: ['categoria'],
      },
    },
  },
  async execute(rawArgs) {
    const { categoria } = z
      .object({ categoria: z.enum(SERIES_CATEGORIES) })
      .parse(rawArgs);

    const definitions = VERIFIED_SERIES.filter((s) => s.categoria === categoria);
    const indicadores = [];

    for (const definition of definitions) {
      const points = await getLastPoints(definition.codigo, 2);
      const latest = latestPoint(points);
      if (!latest) continue;

      indicadores.push({
        indicador: definition.nome,
        ...describePoint(definition, latest),
        variacaoDesdeLeituraAnterior: describeChange(
          definition,
          changeFromPrevious(points, definition.compareAs),
        ),
      });
    }

    if (indicadores.length === 0) return noData(CATEGORY_LABELS[categoria as SeriesCategory]);

    return {
      status: 'OK',
      summary: `${CATEGORY_LABELS[categoria as SeriesCategory]}: ${indicadores.length} indicadores.`,
      data: { area: CATEGORY_LABELS[categoria as SeriesCategory], indicadores },
    };
  },
};

const buscarResumoMacro: Tool = {
  name: 'buscar_resumo_macro',
  definition: {
    type: 'function',
    function: {
      name: 'buscar_resumo_macro',
      description:
        'Panorama com os principais indicadores de juros, inflacao, cambio e atividade. Use para perguntas gerais sobre a economia ou para produzir um resumo.',
      parameters: { type: 'object', properties: {} },
    },
  },
  async execute() {
    const indicadores = [];

    for (const slug of HEADLINE_SLUGS) {
      const definition = findSeriesBySlug(slug);
      if (!definition) continue;

      const points = await getLastPoints(definition.codigo, 2);
      const latest = latestPoint(points);
      if (!latest) continue;

      indicadores.push({
        indicador: definition.nome,
        area: CATEGORY_LABELS[definition.categoria],
        ...describePoint(definition, latest),
        variacaoDesdeLeituraAnterior: describeChange(
          definition,
          changeFromPrevious(points, definition.compareAs),
        ),
      });
    }

    if (indicadores.length === 0) return noData('o panorama macroeconomico');

    return {
      status: 'OK',
      summary: `Panorama com ${indicadores.length} indicadores.`,
      data: { fonte: 'Banco Central do Brasil (SGS)', indicadores },
    };
  },
};

const listarSeriesDisponiveis: Tool = {
  name: 'listar_series_disponiveis',
  definition: {
    type: 'function',
    function: {
      name: 'listar_series_disponiveis',
      description:
        'Lista os indicadores que este painel acompanha. Use quando nao souber se um indicador esta disponivel.',
      parameters: { type: 'object', properties: {} },
    },
  },
  async execute() {
    return {
      status: 'OK',
      summary: `${VERIFIED_SERIES.length} indicadores disponiveis.`,
      data: {
        indicadores: VERIFIED_SERIES.map((definition) => ({
          serie: definition.slug,
          nome: definition.nome,
          area: CATEGORY_LABELS[definition.categoria],
          unidade: definition.unidade,
        })),
      },
    };
  },
};

export const TOOLS: Tool[] = [
  buscarResumoMacro,
  buscarSerieAtual,
  buscarVariacaoPeriodo,
  buscarHistoricoSerie,
  buscarContextoCategoria,
  listarSeriesDisponiveis,
];

export const TOOL_DEFINITIONS: ToolDefinition[] = TOOLS.map((tool) => tool.definition);

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
