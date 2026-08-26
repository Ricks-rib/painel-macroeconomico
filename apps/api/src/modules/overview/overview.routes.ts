import { Router } from 'express';
import { asyncHandler } from '../../http/validate.js';
import { getNarrative } from '../assistant/assistant.service.js';
import { getOverview } from '../series/series.service.js';

export const overviewRouter: Router = Router();

overviewRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    res.json(await getOverview());
  }),
);

/**
 * O resumo escrito pela IA vive num endpoint separado de proposito.
 *
 * Os indicadores da Visao Geral saem do banco em milissegundos; o texto do
 * modelo local leva segundos. Servir os dois juntos faria a tela inteira
 * esperar pelo componente menos essencial -- e, quando o Ollama estiver fora,
 * faria a abertura do painel falhar por causa de um paragrafo.
 */
overviewRouter.get(
  '/overview/narrative',
  asyncHandler(async (_req, res) => {
    res.json(await getNarrative());
  }),
);
