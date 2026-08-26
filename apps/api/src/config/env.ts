import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
/** apps/api -- o .env fica na raiz do app, nao na raiz do monorepo. */
export const API_ROOT = path.resolve(here, '..', '..');

loadDotenv({ path: path.join(API_ROOT, '.env') });

/**
 * Configuracao validada no boot.
 *
 * Falhar aqui, alto e claro, e melhor que descobrir na primeira requisicao que
 * DATABASE_URL estava vazio. Nenhum outro modulo le process.env diretamente.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatorio'),

  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:14b'),

  BCB_API_BASE_URL: z.string().url().default('https://api.bcb.gov.br/dados/serie'),
  BCB_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  SYNC_ON_BOOT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  SYNC_STALE_MINUTES_DIARIA: z.coerce.number().int().positive().default(240),
  SYNC_STALE_MINUTES_MENSAL: z.coerce.number().int().positive().default(720),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');
  // Nao usa o logger: o logger depende deste modulo.
  console.error(`Configuracao invalida em apps/api/.env:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

/** Lista de origens aceitas pelo CORS. */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
