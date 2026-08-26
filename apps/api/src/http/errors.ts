import type { NextFunction, Request, Response } from 'express';
import type { ApiErrorBody } from '@bcb/shared';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

/**
 * Erro de aplicacao com codigo estavel e status HTTP.
 *
 * O `code` e o que o frontend pode ler para decidir comportamento; a `message`
 * e para humanos e pode mudar sem quebrar nada. Distinguir os dois evita o
 * antipadrao de o frontend comparar strings de mensagem.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(resource: string, id?: string): AppError {
    return new AppError(
      404,
      'NOT_FOUND',
      id ? `${resource} nao encontrado: ${id}` : `${resource} nao encontrado`,
    );
  }

  static badRequest(message: string, details?: Array<{ path: string; message: string }>): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: { code: 'ROUTE_NOT_FOUND', message: `Rota inexistente: ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
}

/**
 * Tratador central de erros.
 *
 * Toda resposta de erro da API sai daqui, com o mesmo formato. Erro inesperado
 * nunca devolve stack trace nem mensagem interna ao cliente -- vai para o log
 * do servidor e o cliente recebe uma mensagem generica.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  // Express so reconhece um handler de erro se ele declarar 4 parametros.
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    res.status(error.status).json(body);
    return;
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Parametros invalidos',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
    res.status(400).json(body);
    return;
  }

  logger.error('erro nao tratado', {
    method: req.method,
    path: req.path,
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });

  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
  };
  res.status(500).json(body);
}
