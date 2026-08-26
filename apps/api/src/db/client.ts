import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Instancia unica do Prisma.
 *
 * Em dev o `tsx watch` reinicia o modulo a cada save; sem o cache no
 * globalThis abriria uma conexao nova por reload ate estourar o limite do
 * SQLite. Padrao recomendado pela propria documentacao do Prisma.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.LOG_LEVEL === 'debug'
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
  });

if (env.LOG_LEVEL === 'debug') {
  // @ts-expect-error -- o tipo do evento depende da config de log acima.
  prisma.$on('query', (event: { query: string; params: string; duration: number }) => {
    logger.debug('sql', { ms: event.duration, query: event.query });
  });
}

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
