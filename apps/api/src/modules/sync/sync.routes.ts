import { Router } from 'express';
import { asyncHandler } from '../../http/validate.js';
import { getSyncStatus, triggerSync } from './sync.service.js';

export const syncRouter: Router = Router();

syncRouter.get(
  '/sync/status',
  asyncHandler(async (_req, res) => {
    res.json(await getSyncStatus());
  }),
);

/**
 * Sincronizacao manual.
 *
 * A trava de execucao unica vive no job, nao aqui: se ja houver uma rodada em
 * andamento, esta chamada acompanha a mesma execucao em vez de abrir outra.
 */
syncRouter.post(
  '/sync/run',
  asyncHandler(async (_req, res) => {
    res.json(await triggerSync());
  }),
);
