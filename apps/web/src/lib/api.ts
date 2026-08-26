import type { ApiErrorBody } from '@bcb/shared';

/**
 * Cliente HTTP.
 *
 * Caminhos sempre relativos (`/api/...`): em desenvolvimento o proxy do Vite
 * resolve, e em producao o mesmo bundle funciona atras de qualquer host, sem
 * variavel de ambiente compilada dentro dele.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parseError(response: Response): Promise<ApiRequestError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiRequestError(
      response.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? 'Falha na requisicao',
      body.error?.details,
    );
  } catch {
    return new ApiRequestError(response.status, 'UNKNOWN', `Falha na requisicao (${response.status})`);
  }
}

export async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}
