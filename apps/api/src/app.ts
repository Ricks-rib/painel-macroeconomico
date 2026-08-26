import cors from 'cors';
import express, { type Express } from 'express';
import { corsOrigins } from './config/env.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { assistantRouter } from './modules/assistant/assistant.routes.js';
import { overviewRouter } from './modules/overview/overview.routes.js';
import { seriesRouter } from './modules/series/series.routes.js';
import { syncRouter } from './modules/sync/sync.routes.js';

/**
 * Montagem da aplicacao.
 *
 * Separada de `server.ts` para que o app possa ser instanciado sem abrir uma
 * porta -- o que torna um teste de integracao uma questao de importar esta
 * funcao, nao de subir e derrubar processo.
 */
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '256kb' }));

  // Antes de tudo: um health check nao pode depender de banco nem de LLM.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', at: new Date().toISOString() });
  });

  app.use('/api', overviewRouter);
  app.use('/api', seriesRouter);
  app.use('/api', syncRouter);
  app.use('/api', assistantRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
