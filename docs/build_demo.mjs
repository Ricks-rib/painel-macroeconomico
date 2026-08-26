/**
 * Monta `docs/painel/` — a demonstração estática publicável.
 *
 * O que é publicado é o build de produção do aplicativo real, com três
 * ajustes e nenhum componente reescrito:
 *
 *   1. `VITE_DEMO=1`  → HashRouter, porque um host de arquivos estáticos não
 *                       tem fallback para o index e recarregar em /inflacao
 *                       devolveria 404.
 *   2. `--base=./`    → caminhos relativos, porque o GitHub Pages serve o
 *                       site num subdiretório do domínio.
 *   3. interceptor.js → substitui `window.fetch` antes do pacote carregar e
 *                       responde /api/... a partir das gravações.
 *
 *     node docs/gravar_demo.mjs     # com a API no ar
 *     node docs/build_demo.mjs
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const WEB = join(RAIZ, "apps", "web");
const DESTINO = join(AQUI, "painel");

const GRAVACOES = join(AQUI, "gravacoes.json");
if (!existsSync(GRAVACOES)) {
  console.error("docs/gravacoes.json não existe. Rode `node docs/gravar_demo.mjs` com a API no ar.");
  process.exit(1);
}

/* O binário do Vite pelo caminho, e não por `npx`: no Windows o Node recusa
   spawn de `.cmd` sem shell, e passar por shell traz problema de aspas em
   caminho com espaço. Resolver o script e rodá-lo com o próprio Node evita
   os dois. */
const viteBin = (() => {
  // `require.resolve("vite/bin/vite.js")` não serve: o pacote não expõe esse
  // subcaminho em `exports`. Resolvemos o package.json e caminhamos a partir
  // da pasta dele, que funciona igual com o layout de links do pnpm.
  const req = createRequire(join(WEB, "package.json"));
  const pkg = req.resolve("vite/package.json");
  const bin = join(dirname(pkg), "bin", "vite.js");
  if (!existsSync(bin)) {
    console.error(`build_demo: binário do vite não encontrado em ${bin}`);
    process.exit(1);
  }
  return bin;
})();

console.error("build do aplicativo real…");
rmSync(DESTINO, { recursive: true, force: true });
/* Sem sourcemap: o do build normal tem 3,5 MB e serve para depurar o
   aplicativo, não para publicar uma demonstração. */
execFileSync(
  process.execPath,
  [viteBin, "build", "--base=./", "--outDir", DESTINO, "--emptyOutDir", "--sourcemap", "false"],
  { cwd: WEB, stdio: "inherit", env: { ...process.env, VITE_DEMO: "1" } }
);

const indice = join(DESTINO, "index.html");
let html = readFileSync(indice, "utf8");

/* O interceptor precisa estar instalado ANTES de o pacote da aplicação rodar:
   o React Query dispara as primeiras consultas já na montagem.

   Um <script> clássico executa durante o parse e o pacote é `type=module`,
   portanto adiado -- a ordem daria certo mesmo com a tag no fim do <head>.
   Mas depender dessa sutileza é frágil: basta alguém marcar o interceptor
   como `defer` para a página quebrar de um jeito difícil de diagnosticar.
   Colocá-lo fisicamente antes torna a intenção legível. */
const TAG = '<script src="./interceptor.js"></script>';
const primeiroScript = html.indexOf("<script");
if (primeiroScript === -1) {
  console.error("build_demo: nenhum <script> no index gerado.");
  process.exit(1);
}
html = html.slice(0, primeiroScript) + TAG + "\n    " + html.slice(primeiroScript);

const BANNER = `
  <div id="demo-aviso" style="
    position:fixed;left:0;right:0;bottom:0;z-index:9999;
    display:flex;gap:8px;align-items:center;justify-content:center;
    padding:7px 16px;font:500 12.5px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;
    background:#1c62b5;color:#fff;box-shadow:0 -1px 6px rgba(0,0,0,.18)">
    <span><b>Demonstração com dados congelados</b> — fotografia da base sincronizada com o
    SGS do Banco Central. Para rodar de verdade, veja o
    <a href="https://github.com/Ricks-rib/painel-macroeconomico" style="color:#fff;text-decoration:underline">README</a>.</span>
    <button onclick="document.getElementById('demo-aviso').remove()" aria-label="Fechar aviso"
      style="background:none;border:0;color:#fff;cursor:pointer;font-size:16px;line-height:1;padding:0 2px">×</button>
  </div>`;
html = html.replace("</body>", `${BANNER}\n</body>`);

writeFileSync(indice, html, "utf8");

copyFileSync(join(AQUI, "interceptor.js"), join(DESTINO, "interceptor.js"));

/* O arquivo versionado fica indentado, para o diff ser legível quando a
   gravação muda. O publicado vai compacto: a indentação é mais de um terço
   do peso, e ninguém lê JSON num navegador. */
writeFileSync(
  join(DESTINO, "gravacoes.json"),
  JSON.stringify(JSON.parse(readFileSync(GRAVACOES, "utf8"))),
  "utf8"
);

const kb = (p) => (readFileSync(p).length / 1024).toFixed(0);
console.error(`\ngerado: docs/painel/`);
console.error(`  index.html      ${kb(indice)} KB`);
console.error(`  interceptor.js  ${kb(join(DESTINO, "interceptor.js"))} KB`);
console.error(`  gravacoes.json  ${kb(join(DESTINO, "gravacoes.json"))} KB`);
