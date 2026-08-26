/**
 * Camada de rede da demonstração estática.
 *
 * POR QUE INTERCEPTAR EM VEZ DE REPLICAR
 *
 * A demonstração precisa ser *o painel*, não uma imitação dele. Uma réplica
 * escrita à parte diverge do produto no primeiro ajuste de componente, e uma
 * demonstração que não corresponde ao sistema é pior que nenhuma.
 *
 * Então o que está publicado aqui é o build de produção do aplicativo real —
 * os mesmos componentes, os mesmos gráficos, o mesmo CSS. A única coisa
 * trocada é de onde vêm os dados: este arquivo substitui `window.fetch`
 * antes de o pacote da aplicação carregar, e responde `/api/...` a partir de
 * uma fotografia das respostas reais da API.
 *
 * Consequência prática: o seletor de período funciona, a navegação entre
 * páginas funciona, os gráficos são os do produto. O que não funciona é
 * perguntar ao assistente algo fora do roteiro gravado — e nesse caso ele diz
 * isso, em vez de inventar.
 */
(function () {
  "use strict";

  const fetchOriginal = window.fetch.bind(window);
  let dados = null;

  const carregando = fetch("./gravacoes.json")
    .then((r) => r.json())
    .then((d) => (dados = d));

  const json = (corpo, status = 200) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  /** Compara perguntas ignorando acento, caixa e pontuação. */
  const chave = (s) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const SEM_ROTEIRO =
    "Esta é uma demonstração com respostas gravadas do painel real — ela não consulta " +
    "o modelo ao vivo. As perguntas sugeridas abaixo do campo mostram a conversa " +
    "completa, com as ferramentas que cada uma dispara. Para perguntar o que quiser, " +
    "rode o projeto local: as instruções estão no README.";

  function responderChat(corpo) {
    const pedido = JSON.parse(corpo);
    const alvo = chave(pedido.message);

    for (const conversa of dados.conversas) {
      for (const troca of conversa.trocas) {
        if (chave(troca.pergunta) !== alvo) continue;
        return json({
          reply: troca.resposta,
          toolCalls: troca.toolCalls,
          groundingCorrected: troca.groundingCorrected,
        });
      }
    }
    return json({ reply: SEM_ROTEIRO, toolCalls: [], groundingCorrected: false });
  }

  /* A janela pedida pode não ter sido gravada (a gravação cobre as opções do
     seletor). Cair na mais próxima é melhor que devolver 404 e pintar a tela
     de erro por causa de um parâmetro. */
  function porJanela(mapa, dias) {
    if (mapa[dias]) return mapa[dias];
    const disponiveis = Object.keys(mapa).map(Number);
    const proxima = disponiveis.reduce((a, b) =>
      Math.abs(b - dias) < Math.abs(a - dias) ? b : a
    );
    return mapa[proxima];
  }

  window.fetch = async function (entrada, init) {
    const url = typeof entrada === "string" ? entrada : entrada?.url ?? String(entrada);

    if (!url.includes("/api/")) return fetchOriginal(entrada, init);
    if (!dados) await carregando;

    const u = new URL(url, location.href);
    const caminho = u.pathname.replace(/^.*\/api\//, "/");
    const dias = Number(u.searchParams.get("days") ?? 365);

    if (caminho === "/catalog") return json(dados.catalogo);
    if (caminho === "/overview") return json(dados.overview);
    if (caminho === "/overview/narrative") return json(dados.narrative);
    if (caminho === "/sync/status") return json(dados.sync);

    if (caminho === "/assistant/status")
      return json({ availability: "OK", model: dados.modelo, message: null });

    if (caminho === "/assistant/chat")
      return responderChat(init?.body ?? "{}");

    /* Sincronizar sob demanda tocaria a API do Banco Central. Numa página
       estática o botão não pode fazer isso -- e fingir que sincronizou seria
       pior que dizer que não dá. */
    if (caminho === "/sync/run")
      return json(
        {
          code: "DEMO",
          message:
            "Esta é uma demonstração estática: os dados são uma fotografia da base já " +
            "sincronizada com o SGS do Banco Central, tirada em " +
            dados.gravadoEm +
            ". Rodando o projeto local, este botão busca os dados de verdade.",
        },
        503
      );

    const serie = caminho.match(/^\/series\/(.+)$/);
    if (serie) {
      const mapa = dados.series[decodeURIComponent(serie[1])];
      return mapa ? json(porJanela(mapa, dias)) : json({ code: "NOT_FOUND" }, 404);
    }

    const categoria = caminho.match(/^\/categories\/(.+)$/);
    if (categoria) {
      const mapa = dados.categorias[decodeURIComponent(categoria[1])];
      return mapa ? json(porJanela(mapa, dias)) : json({ code: "NOT_FOUND" }, 404);
    }

    return json({ code: "NOT_FOUND", message: `rota não gravada: ${caminho}` }, 404);
  };
})();
