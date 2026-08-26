import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, parseBody } from '../../http/validate.js';
import { getStatus, runChat } from './assistant.service.js';

/**
 * O contexto da tela chega do cliente, entao e validado como qualquer outra
 * entrada -- inclusive no tamanho. Sem o teto de itens, uma pagina com muitas
 * series (ou um cliente adulterado) empurraria um bloco arbitrariamente grande
 * para dentro do prompt.
 */
const screenContextSchema = z
  .object({
    pagina: z.string().min(1).max(80),
    periodoDias: z.number().int().positive().max(1825).nullable(),
    series: z
      .array(
        z.object({
          codigo: z.number().int(),
          slug: z.string().min(1).max(60),
          nome: z.string().min(1).max(120),
          unidade: z.string().max(30),
          valorAtual: z.number(),
          dataAtual: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .max(12),
  })
  .nullable();

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20)
    .default([]),
  screenContext: screenContextSchema.default(null),
});

export const assistantRouter: Router = Router();

assistantRouter.get(
  '/assistant/status',
  asyncHandler(async (_req, res) => {
    res.json(await getStatus());
  }),
);

assistantRouter.post(
  '/assistant/chat',
  asyncHandler(async (req, res) => {
    res.json(await runChat(parseBody(req, chatSchema)));
  }),
);
