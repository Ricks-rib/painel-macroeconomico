/**
 * Grava os dados da demonstração estática do painel.
 *
 * Uma fotografia das respostas reais da API, tirada com a base já
 * sincronizada com o SGS do Banco Central. Roda com a API no ar:
 *
 *     pnpm dev                       # noutro terminal
 *     node docs/gravar_demo.mjs
 *
 * A conversa do assistente é gravada de verdade, turno a turno, com o
 * histórico crescendo como cresce na tela. Ela existe para mostrar a
 * fronteira que o projeto defende: uma pergunta conceitual respondida SEM
 * consultar nada, e a pergunta de valor seguinte disparando a ferramenta.
 * Uma conversa inventada não demonstraria isso — demonstraria que sei
 * escrever diálogo.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.API ?? "http://localhost:4000";
const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, "gravacoes.json");

async function pegar(caminho) {
  const r = await fetch(`${API}${caminho}`);
  if (!r.ok) throw new Error(`GET ${caminho} → HTTP ${r.status}`);
  return r.json();
}

async function conversar(message, history, screenContext = null) {
  const r = await fetch(`${API}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, screenContext }),
  });
  if (!r.ok) throw new Error(`POST /assistant/chat → HTTP ${r.status}`);
  return r.json();
}

/* As duas conversas foram escolhidas para exercitar decisões distintas. */
const ROTEIROS = [
  {
    id: "conceito-e-valor",
    titulo: "Pergunta conceitual e pergunta de valor são coisas diferentes",
    nota:
      "A primeira não chama ferramenta nenhuma: não há número a buscar. A segunda chama. " +
      "É a fronteira entre explicar e medir, visível na própria interface.",
    screenContext: null,
    turnos: [
      "o que é inflação?",
      "e quanto ela está?",
      "isso é alto comparado com o começo do ano?",
    ],
  },
  {
    id: "contexto-da-tela",
    titulo: "O assistente vê o que você está vendo — e para onde não vê",
    nota:
      "Com a página de Inflação aberta, a primeira pergunta é respondida sem consulta " +
      "nenhuma: os números já chegaram como retorno da ferramenta `contexto_da_tela`. " +
      "A segunda sai do recorte e dispara a ferramenta de verdade. A terceira pede um " +
      "indicador que o catálogo não tem, e o assistente diz que não tem em vez de " +
      "aproximar com o que tem à mão.",
    screenContext: {
      pagina: "Inflação",
      periodoDias: 365,
      series: [],
    },
    turnos: [
      "qual desses três indicadores está negativo?",
      "e o dólar?",
      "e a taxa de desemprego?",
    ],
  },
];

async function main() {
  const status = await pegar("/api/assistant/status");
  if (status.availability !== "OK") {
    console.error(`Assistente indisponível (${status.availability}): ${status.message}`);
    console.error("A gravação precisa da geração real. Suba o Ollama e tente de novo.");
    process.exit(1);
  }

  console.error("catálogo, visão geral e sincronização…");
  const catalogo = await pegar("/api/catalog");
  const overview = await pegar("/api/overview");
  const sync = await pegar("/api/sync/status");

  // Todos os períodos que o seletor oferece. Gravar só um deixaria o
  // controle na tela mentindo: ele mudaria de estado sem mudar o gráfico.
  const PERIODOS = [30, 90, 180, 365, 1095];

  console.error(`séries (${catalogo.entries.length} × ${PERIODOS.length} janelas)…`);
  const series = {};
  for (const e of catalogo.entries) {
    series[e.slug] = {};
    for (const d of PERIODOS) series[e.slug][d] = await pegar(`/api/series/${e.slug}?days=${d}`);
  }

  console.error("categorias…");
  const categorias = {};
  for (const c of [...new Set(catalogo.entries.map((e) => e.categoria))]) {
    categorias[c] = {};
    for (const d of PERIODOS) categorias[c][d] = await pegar(`/api/categories/${c}?days=${d}`);
  }

  console.error("resumo automático (passa pela checagem de ancoragem)…");
  const narrative = await pegar("/api/overview/narrative");

  // O contexto de tela do segundo roteiro sai do dado real, não de valores
  // escritos à mão: é o recorte que a página de Inflação de fato monta.
  const inflacao = catalogo.entries.filter((e) => e.categoria === "INFLACAO");
  ROTEIROS[1].screenContext.series = inflacao.map((e) => {
    const s = series[e.slug][365];
    const ultimo = s.points.at(-1);
    return {
      codigo: e.codigo,
      slug: e.slug,
      nome: e.nome,
      unidade: e.unidade,
      valorAtual: ultimo.valor,
      dataAtual: ultimo.data,
    };
  });

  console.error("conversas…");
  const conversas = [];
  for (const roteiro of ROTEIROS) {
    const history = [];
    const trocas = [];
    for (const pergunta of roteiro.turnos) {
      const t0 = Date.now();
      const r = await conversar(pergunta, history, roteiro.screenContext);
      const ms = Date.now() - t0;
      history.push({ role: "user", content: pergunta });
      history.push({ role: "assistant", content: r.reply });
      trocas.push({
        pergunta,
        resposta: r.reply,
        toolCalls: r.toolCalls,
        groundingCorrected: r.groundingCorrected,
        ms,
      });
      const fs = r.toolCalls.map((t) => t.name).join(", ") || "nenhuma ferramenta";
      console.error(`  “${pergunta}” → ${ms} ms · ${fs}`);
    }
    conversas.push({ ...roteiro, trocas });
  }

  const dados = {
    gravadoEm: new Date().toISOString().slice(0, 10),
    modelo: status.model,
    catalogo,
    overview,
    sync,
    narrative,
    series,
    categorias,
    conversas,
  };

  writeFileSync(SAIDA, JSON.stringify(dados, null, 2), "utf8");
  const kb = Buffer.byteLength(JSON.stringify(dados)) / 1024;
  console.error(`\ngravado: docs/gravacoes.json  (${kb.toFixed(0)} KB)`);
  console.error(
    `  ${catalogo.entries.length} séries · ${Object.keys(categorias).length} categorias · ` +
      `${conversas.reduce((n, c) => n + c.trocas.length, 0)} turnos de conversa`
  );
}

main().catch((e) => {
  console.error(`falhou: ${e.message}`);
  process.exit(1);
});
