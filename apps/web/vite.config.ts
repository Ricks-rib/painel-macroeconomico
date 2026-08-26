import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Portas configuraveis, com os mesmos padroes de sempre.
 *
 * Este painel e o cod-dashboard nasceram com as mesmas portas (4000 e 5173).
 * Sao repositorios separados, entao no uso normal isso nao incomoda -- mas
 * quem clonar os dois para comparar sobe um e o outro morre com EADDRINUSE.
 * O alvo do proxy precisava acompanhar: com ele fixo no codigo, mudar `PORT`
 * na API so faria o frontend bater numa porta vazia.
 */
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const API_PORT = Number(process.env.API_PORT ?? 4000);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: WEB_PORT,
    /**
     * O frontend fala sempre em caminho relativo (`/api/...`). Assim nenhuma
     * URL de backend fica compilada no pacote, e trocar de ambiente e trocar o
     * proxy -- nao reconstruir o bundle.
     */
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
