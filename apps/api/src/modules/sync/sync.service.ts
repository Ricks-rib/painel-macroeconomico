import type { SyncStatus, SyncStatusResponse } from '@bcb/shared';
import { VERIFIED_SERIES } from '@bcb/shared';
import { prisma } from '../../db/client.js';
import { minutesSince } from '../../lib/dates.js';
import { isSyncRunning, syncAll } from '../../jobs/sync.js';
import { getFreshness } from '../series/series.repo.js';

/**
 * Estado da sincronizacao, do jeito que a interface precisa exibir.
 *
 * A idade do dado e calculada sobre a serie MAIS VELHA entre as exibidas, nao
 * sobre a media: o cabecalho promete "os dados estao atualizados ate X", e essa
 * promessa vale pelo elo mais fraco.
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const [lastRun, lastSuccess, freshness] = await Promise.all([
    prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.syncRun.findFirst({
      where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { startedAt: 'desc' },
    }),
    getFreshness(VERIFIED_SERIES.map((s) => s.codigo)),
  ]);

  let stalestMinutes: number | null = null;
  for (const definition of VERIFIED_SERIES) {
    const entry = freshness.get(definition.codigo);
    // Serie nunca sincronizada conta como indisponivel, nao como "idade zero".
    if (!entry?.syncedAt) {
      stalestMinutes = null;
      break;
    }
    const age = minutesSince(entry.syncedAt);
    stalestMinutes = stalestMinutes === null ? age : Math.max(stalestMinutes, age);
  }

  const failures = parseFailures(lastRun?.seriesFailed);

  return {
    lastRunAt: lastRun?.startedAt.toISOString() ?? null,
    lastRunStatus: (lastRun?.status as SyncStatus | undefined) ?? null,
    lastSuccessAt: lastSuccess?.finishedAt?.toISOString() ?? null,
    failures,
    stalestMinutes,
    running: isSyncRunning(),
  };
}

function parseFailures(raw: string | undefined): SyncStatusResponse['failures'] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SyncStatusResponse['failures'];
  } catch {
    return [];
  }
}

/** Dispara uma sincronizacao manual e devolve o estado resultante. */
export async function triggerSync(): Promise<SyncStatusResponse> {
  await syncAll();
  return getSyncStatus();
}
