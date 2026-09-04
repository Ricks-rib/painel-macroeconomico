# Painel Macroeconômico — indicadores do Banco Central com IA local

**[▶ Abrir o painel](https://ricks-rib.github.io/painel-macroeconomico/painel/)**  ·
**[📄 Ler o dossiê](https://ricks-rib.github.io/painel-macroeconomico/dossie.html)**

*Ambos abrem no navegador, sem instalar nada. O painel é o build real da aplicação,
com os dados congelados; o dossiê traz as decisões de arquitetura e a medição que
sustenta cada uma.*

---

Painel de séries temporais do **SGS/Banco Central do Brasil** — juros, inflação,
câmbio, atividade e crédito — com resumo automático e assistente conversacional
rodando num modelo local.

O dado é real e público. O que o projeto demonstra é o que se constrói **em volta**
dele: uma fronteira honesta entre o que é calculado e o que é gerado, e a recusa
de exibir um número que não se possa rastrear até a fonte.

---

## Como rodar

**Pré-requisitos:** Node 20+, pnpm e — opcional — [Ollama](https://ollama.com).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env

pnpm db:push      # cria o SQLite a partir do schema
pnpm sync         # primeira carga: busca o histórico na API do BCB
pnpm dev          # API em :4000, painel em :5173
```

Para as funcionalidades de IA:

```bash
ollama pull qwen2.5:14b
```

**Sem o Ollama o projeto funciona.** Os indicadores, os gráficos e o histórico
são completos sem ele — apenas o resumo de abertura e o chat ficam indisponíveis,
e a interface diz isso em vez de mostrar um espaço vazio. Essa não é uma
conveniência: é o teste de que a fronteira entre dado e narração está no lugar
certo.

Outros comandos:

```bash
pnpm test         # a checagem de ancoragem (o componente que mais precisa dela)
pnpm typecheck    # verifica os três pacotes
pnpm db:studio    # inspeciona a base local
```

---

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Monorepo | pnpm workspaces | Catálogo e fórmulas compartilhados sem publicar pacote |
| Frontend | React 19 + TypeScript + Vite | SPA; sem SEO a resolver, SSR não se justifica |
| Estado de servidor | TanStack Query | O problema real é *manter o número atualizado*, não buscá-lo |
| Gráficos | Recharts | Declarativo, resolve o caso comum sem D3 puro |
| UI | Tailwind v4 (tokens em `@theme`) | Nenhum componente usa cor literal |
| Backend | Express 5 + TypeScript | Camadas explícitas, sem mágica de framework |
| ORM / Banco | Prisma + SQLite | Cache local da fonte externa, sem infraestrutura |
| LLM | Ollama (qwen2.5:14b) | Local: o painel não depende de serviço de terceiro |

---

## As decisões que sustentam o projeto

### 1. A fonte externa não pode derrubar o painel

O SGS é público, gratuito e fora do nosso controle. Um painel que consulta a API
do BCB a cada carregamento de tela fica tão disponível quanto ela — e tão lento
quanto ela num dia ruim.

Por isso há uma camada de sincronização: um job busca as séries, grava os pontos
em SQLite, e **toda leitura vem da cópia local**. A API externa é tocada em três
momentos — no boot, a cada hora, e sob demanda quando uma série passa do prazo de
revalidação da sua frequência (uma série mensal não ganha nada sendo consultada
de hora em hora).

O preço é que o painel passa a ser eventualmente consistente. Por isso todo
cabeçalho exibe a idade do dado e as séries que falharam na última tentativa —
um painel que assume esse custo e não informa está mentindo por omissão.

Testado com a fonte inacessível: as 14 séries falham, a tela continua servindo o
último dado conhecido e as 14 falhas aparecem no cabeçalho.

### 2. O que a API do SGS faz de inesperado

Nada abaixo estava numa documentação; tudo foi medido contra a API real, e cada
item quebraria uma implementação ingênua:

```
/dados/ultimos/{N}   recusa N > 20     -> HTTP 400 "A quantidade máxima de valores deve ser 20"
/dados?dataInicial…  recusa faixa longa -> HTTP 406 acima de ~10 anos
intervalo sem dados                     -> HTTP 404, não lista vazia
código inexistente                      -> página HTML, não JSON
formato JSON usa "5.1862"; CSV usa "4,74"
```

O teto de 20 pontos é o que define a estratégia de carga: **backfill** pelo
endpoint de intervalo, fatiado em janelas de 9 anos, e **incremental** pelos
últimos 20 pontos — que na revalidação de rotina sobram, e ainda pegam revisão
retroativa recente. Os quatro comportamentos estão codificados e comentados em
[`bcb-client.ts`](apps/api/src/lib/bcb-client.ts).

### 3. Um código do SGS é um número opaco

`20714` parecia inadimplência de pessoa física. Devolveu ~33% — impossível para
inadimplência de crédito. `13521` parecia o IPCA acumulado em 12 meses. Devolveu
3,00 fixo em 2024, 2025 e 2026: é meta de inflação, não índice.

Nenhum dos dois teria dado erro. Teriam virado um card com um número errado, e
quem olhasse não teria como perceber.

Por isso a verificação é **um campo do dado**, não uma etapa que alguém lembra de
fazer: cada série no [catálogo](packages/shared/src/series-catalog.ts) carrega
`verified`, a data da conferência e a evidência que a sustenta. Série não
verificada não entra em sincronização, nem em ferramenta de IA, nem em gráfico —
aparece só na tela de Configurações, marcada como pendente, com link para o
catálogo oficial.

São 14 séries conferidas contra a API real, com o que foi checado anotado uma a
uma (a Selic diária vem em % ao dia, não ao ano; o CDI diário coincide com a
Selic efetiva por conjuntura, não por definição; a inadimplência de PF fica
sempre acima do total, como a composição da carteira exige).

### 4. Variação percentual e ponto percentual não são a mesma coisa

Dizer que o IPCA "caiu 56%" ao ir de 0,16% para 0,07% é aritmeticamente
verdadeiro e praticamente inútil. O que um economista diz é "caiu 0,09 p.p.".

Cada série declara no catálogo como deve ser comparada — pontos percentuais para
as que já são percentuais, variação relativa para as de nível — e o servidor
resolve isso **uma vez**, em [`metrics.ts`](packages/shared/src/metrics.ts). O
card, o gráfico e o assistente recebem o mesmo número com a mesma unidade; não
existe caminho em que dois deles discordem.

A mesma disciplina vale para a cor: cada série declara se subir é bom, ruim ou
nenhum dos dois. IPCA subindo é vermelho, PIB subindo é verde, **Selic e câmbio
são neutros** — alta do dólar beneficia exportador e penaliza importador, e alta
de juros é decisão de política monetária, não notícia boa ou ruim. Pintar isso de
verde ou vermelho seria o painel emitindo um juízo que o dado não sustenta.

### 5. Prompt é mitigação; a regra que precisa valer sempre existe em código

O assistente usa **function calling**: seis ferramentas com parâmetros tipados e
consultas pré-escritas. O modelo escolhe o que perguntar; ele nunca gera consulta
nem calcula variação — as ferramentas devolvem o número já calculado, das mesmas
funções que alimentam a tela.

Isso não basta. Toda resposta passa por uma
[checagem de ancoragem](apps/api/src/ai/grounding.ts): cada número presente no
texto é conferido contra os números que passaram pelo retorno das ferramentas
naquele turno. Número sem origem reprova a resposta, o sistema injeta uma
correção e força nova consulta; reincidiu, a resposta vira uma admissão de que
não sabe.

A checagem **confere origem, não pertinência**. Ela garante que todo número
saiu de uma ferramenta; não garante que ele responde à pergunta nem que
continua com o nome do indicador de onde veio. Medido: pressionado por uma
correção, o modelo buscou a série `meta-selic` e a rotulou como meta de
inflação — o número tinha origem legítima e o rótulo estava trocado. A
mitigação está no prompt; verificar pertinência em código exigiria o sistema
saber o que cada série *significa*, e isso não está feito.

`OLLAMA_SEED` fixa a amostragem. Temperatura baixa não é temperatura zero, e
sem semente a mesma pergunta com o mesmo histórico dá respostas diferentes
entre execuções — um defeito que aparece uma vez a cada tantas não tem como
ser investigado.

Quatro episódios reais, todos preservados como caso de teste:

```
Modelo recebeu  variacao: -0.2189 (%)  e  diferencaAbsoluta: -0.0113 (R$)
Modelo escreveu "variação de -1,13%"                          [errado]
```
A checagem pegou. Mas a correção certa não foi ajustar o prompt: foi **parar de
entregar duas grandezas parecidas para a mesma pergunta**. A ferramenta passou a
devolver um número só por conceito.

```
Modelo escreveu "R$ 1.167.869 milhões"    -> reprovado como invenção  [falso positivo]
Modelo escreveu "queda de 0,22%"          -> reprovado como invenção  [falso positivo]
```
O primeiro porque o extrator quebrava o separador de milhar brasileiro em "1.167"
e "869". O segundo porque em português o sentido da variação vai na palavra, não
no sinal: "queda de 0,22%" é a forma correta de dizer −0,22%. Ambos reprovavam
respostas **corretas** — e um verificador que reprova o certo é abandonado na
primeira semana.

### 6. O assistente vê o que você está vendo

Cada página registra o recorte que está na tela; o chat envia isso junto com a
pergunta. Perguntar "e isso aí, está alto?" olhando o gráfico funciona.

O detalhe está em **como** esse bloco entra: como se fosse o retorno de uma
ferramenta chamada `contexto_da_tela`. Colá-lo no prompt criaria um buraco na
checagem — ela só considera fundamentado o que passou por ferramenta, e o modelo
seria acusado de inventar um número que está na tela. Tratando o contexto como
mais uma origem declarada, os números visíveis passam pelo mesmo caminho e pela
mesma regra. Nenhuma garantia foi enfraquecida.

Na prática: com o IPCA na tela, "qual o IPCA acumulado?" é respondido sem
consulta nenhuma; "e o dólar?" dispara a ferramenta. A interface mostra qual foi
o caso, sob cada resposta.

### 7. A paleta foi medida, não escolhida

Fundo claro é mais difícil que escuro: a margem de contraste é menor e o erro é
menos perdoável quando o painel vai para uma reunião projetada.

Todos os valores em [`index.css`](apps/web/src/index.css) foram validados —
faixa de luminosidade, piso de croma, separação sob daltonismo e contraste, contra
as duas superfícies reais do painel. As cores de texto foram conferidas no piso de
4,5:1, e não no de 3:1, porque aparecem em número pequeno.

A escala categórica tem **três cores, e o limite é proposital**: os três passam
em todos os pares nos dois fundos; a quarta cor, em todas as ordenações testadas,
aproximava demais dois tons. Nenhum gráfico deste painel precisa de mais de três
séries — quando precisar, a saída é separar em gráficos, não inventar um quarto
tom.

Pela mesma razão **não existe gráfico de dois eixos**. Sobrepor a meta Selic (14%
ao ano) e a Selic efetiva (0,05% ao dia) numa figura com duas escalas produz
cruzamentos que não significam nada — o ponto de encontro depende de como cada
eixo foi esticado. As séries são agrupadas por unidade e cada grupo ganha seu
gráfico.

---

## Estrutura

```
BCB-dashboard/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/schema.prisma     tabela genérica de pontos + auditoria de sync
│  │  └─ src/
│  │     ├─ lib/bcb-client.ts     a fronteira com o SGS e suas peculiaridades
│  │     ├─ jobs/sync.ts          backfill e incremental, idempotentes
│  │     ├─ ai/                   ollama · tools · grounding · context
│  │     └─ modules/              series · overview · sync · assistant
│  └─ web/
│     └─ src/
│        ├─ components/           charts · common · layout · chat · ui
│        ├─ lib/                  api · queries · format · period · screen-context
│        └─ pages/
└─ packages/
   └─ shared/                     catálogo de séries · métricas · contratos
```

**Regra de dependência:** o frontend nunca importa tipo gerado pelo Prisma. O que
atravessa a rede está declarado em `packages/shared`.

**Contas em um lugar só:** variação, média móvel e recorte de janela vivem em
[`metrics.ts`](packages/shared/src/metrics.ts) e são consumidos pela API e pelas
ferramentas do assistente. O frontend formata; não calcula.

---

## Fora de escopo, deliberadamente

- **Autenticação.** Dado macroeconômico é público — não há dono do dado a
  proteger, e inventar um login seria teatro. O que permanece da disciplina de
  acesso é a superfície de consulta fechada do assistente: o modelo nunca gera
  consulta, só escolhe entre ferramentas pré-escritas.
- **Tema escuro.** Claro por decisão, não por limitação — a paleta foi validada
  para a superfície clara. Suportar o escuro é re-declarar o bloco de tokens sob
  uma media query; nenhum componente muda, porque nenhum usa cor literal.
- **Deploy.** Roda local. `pnpm build` faz typecheck e build do front.
- **Previsão e recomendação.** O assistente descreve o que os dados dizem e é
  instruído a não projetar nem aconselhar investimento.

## O que eu faria diferente com mais escala

| Hoje | Com volume real |
|---|---|
| SQLite | Postgres, com as séries particionadas por código |
| Derivação em tempo de leitura | Materialização das janelas mais consultadas |
| `setInterval` no processo da API | Worker de fila, com retry por série |
| Sincronização série a série, sequencial | Paralelismo limitado, respeitando o serviço público |
| Histórico do chat na requisição | Persistido, com sessão do servidor |
| Verificação de série anotada no catálogo | Rotina que confere a ordem de grandeza a cada sync |
