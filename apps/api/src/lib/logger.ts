import { env } from '../config/env.js';

/**
 * Logger estruturado minimo.
 *
 * Deliberadamente sem dependencia externa: o projeto so precisa de nivel,
 * carimbo de tempo e contexto em objeto. Em producao trocaria por pino, e a
 * assinatura abaixo (mensagem + objeto de contexto) e a mesma -- a troca seria
 * de uma linha.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVEL_ORDER[env.LOG_LEVEL];

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < threshold) return;

  const time = new Date().toISOString().slice(11, 23);
  const tag = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`;
  const suffix = context && Object.keys(context).length > 0 ? ` ${format(context)}` : '';

  const line = `${time} ${tag} ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function format(context: Record<string, unknown>): string {
  return Object.entries(context)
    .map(([key, value]) => {
      if (value instanceof Error) return `${key}=${value.message}`;
      if (typeof value === 'object' && value !== null) return `${key}=${JSON.stringify(value)}`;
      return `${key}=${String(value)}`;
    })
    .join(' ');
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
