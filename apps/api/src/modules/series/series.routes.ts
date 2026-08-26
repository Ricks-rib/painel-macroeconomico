import { Router } from 'express';
import { SERIES_CATEGORIES } from '@bcb/shared';
import { z } from 'zod';
import { asyncHandler, parseParams, parseQuery } from '../../http/validate.js';
import { getCatalog, getCategory, getSeriesBySlug } from './series.service.js';

/**
 * Janela padrao de um ano. Cobre a leitura usual sem carregar historico que a
 * tela nao vai desenhar -- o backfill guarda mais anos, mas quem quer serie
 * longa pede explicitamente.
 */
const periodSchema = z.object({
  days: z.coerce.number().int().min(7).max(1825).default(365),
});

export const seriesRouter: Router = Router();

seriesRouter.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    res.json(await getCatalog());
  }),
);

seriesRouter.get(
  '/categories/:categoria',
  asyncHandler(async (req, res) => {
    const { categoria } = parseParams(req, z.object({ categoria: z.enum(SERIES_CATEGORIES) }));
    const { days } = parseQuery(req, periodSchema);
    res.json(await getCategory(categoria, days));
  }),
);

seriesRouter.get(
  '/series/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = parseParams(req, z.object({ slug: z.string().min(1) }));
    const { days } = parseQuery(req, periodSchema);
    res.json(await getSeriesBySlug(slug, days));
  }),
);
