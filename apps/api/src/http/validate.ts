import type { Request } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Validacao na fronteira HTTP.
 *
 * Tudo que entra pela rede passa por um schema antes de virar argumento de
 * funcao. O ganho nao e so seguranca: dentro do servico os tipos sao reais, e
 * nao promessas nao verificadas vindas de `req.query`.
 *
 * A entrada e tipada como `unknown` de proposito. Com `ZodSchema<T>` o
 * TypeScript casa entrada e saida no mesmo T, e todo campo com `.default()`
 * volta como opcional -- o valor padrao, que existe justamente para garantir a
 * presenca, passaria a exigir checagem de `undefined` em quem chama.
 */
type InputSchema<T> = ZodType<T, ZodTypeDef, unknown>;

export function parseQuery<T>(req: Request, schema: InputSchema<T>): T {
  return schema.parse(req.query);
}

export function parseParams<T>(req: Request, schema: InputSchema<T>): T {
  return schema.parse(req.params);
}

export function parseBody<T>(req: Request, schema: InputSchema<T>): T {
  return schema.parse(req.body);
}

/**
 * Envolve um handler assincrono para que rejeicoes chegem ao tratador central.
 *
 * O Express 5 ja encaminha promessas rejeitadas, mas declarar isso
 * explicitamente mantem o comportamento obvio na leitura de cada rota.
 */
export function asyncHandler<T>(
  handler: (req: Request, res: import('express').Response) => Promise<T>,
) {
  return (
    req: Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ): void => {
    handler(req, res).catch(next);
  };
}
