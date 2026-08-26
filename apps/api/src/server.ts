import { createApp } from './app.js';
import { warmUp } from './ai/ollama.js';
import { env } from './config/env.js';
import { disconnect } from './db/client.js';
import { startScheduler, stopScheduler, syncAll } from './jobs/sync.js';
import { logger } from './lib/logger.js';

/**
 * Boot.
 *
 * Duas tarefas disparam sem bloquear a abertura da porta: carregar o modelo na
 * memoria e sincronizar as series. Nenhuma das duas e pre-requisito para
 * servir -- se o Ollama estiver fora ou o SGS demorar, a API sobe do mesmo
 * jeito e responde com o que ja tem em banco.
 */
const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('API no ar', { porta: env.PORT, ambiente: env.NODE_ENV });

  void warmUp();

  if (env.SYNC_ON_BOOT) {
    syncAll().catch((error: unknown) => {
      logger.error('sincronizacao de boot falhou', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  startScheduler(env.SYNC_INTERVAL_MINUTES);
});

/**
 * Encerramento ordenado.
 *
 * Sem isto, o `tsx watch` deixaria conexoes do SQLite penduradas a cada
 * reinicio ate o processo travar em lock de arquivo.
 */
function shutdown(signal: string): void {
  logger.info('encerrando', { signal });
  stopScheduler();

  server.close(() => {
    void disconnect().finally(() => process.exit(0));
  });

  // Rede de seguranca: se algo segurar o processo, sai mesmo assim.
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
