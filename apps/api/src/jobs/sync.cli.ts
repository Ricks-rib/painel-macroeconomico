import { disconnect } from '../db/client.js';
import { logger } from '../lib/logger.js';
import { syncAll } from './sync.js';

/**
 * Sincronizacao pela linha de comando: `pnpm sync`.
 *
 * E o equivalente ao "seed" de um projeto com dados ficticios -- so que aqui
 * nao ha dado inventado para semear. A base nasce da fonte real, e por isso e
 * reproduzivel de outra forma: apagar o arquivo e rodar de novo devolve o
 * mesmo historico publico.
 */
async function main(): Promise<void> {
  const result = await syncAll();

  logger.info('---');
  for (const item of result.ok) {
    logger.info(`ok    ${String(item.codigo).padStart(6)}  ${item.nome}`, {
      modo: item.mode,
      pontos: item.pointsWritten,
    });
  }
  for (const item of result.failed) {
    logger.error(`falha ${String(item.codigo).padStart(6)}  ${item.nome}`, { motivo: item.error });
  }
  logger.info('---');
  logger.info('resultado', {
    status: result.status,
    pontos: result.pointsWritten,
    segundos: (result.durationMs / 1000).toFixed(1),
  });

  // PARTIAL nao e sucesso: se uma serie ficou de fora, quem chamou (uma
  // pipeline, por exemplo) precisa poder detectar isso pelo codigo de saida.
  if (result.status !== 'SUCCESS') process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    logger.error('sincronizacao abortada', {
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void disconnect();
  });
