import type { SeriesPoint } from '@bcb/shared';
import { prisma } from '../../db/client.js';

/**
 * Acesso aos pontos de serie.
 *
 * A camada de servico nunca monta query: se um dia o SQLite virar Postgres, a
 * mudanca fica contida neste arquivo.
 */

/** Pontos de uma serie, em ordem cronologica. `since` e uma data ISO inclusiva. */
export async function getPoints(codigo: number, since?: string): Promise<SeriesPoint[]> {
  const rows = await prisma.seriesPoint.findMany({
    where: { codigo, ...(since ? { data: { gte: since } } : {}) },
    orderBy: { data: 'asc' },
    select: { data: true, valor: true },
  });

  return rows;
}

/** Ultimos N pontos, devolvidos em ordem cronologica (a consulta e decrescente). */
export async function getLastPoints(codigo: number, limit: number): Promise<SeriesPoint[]> {
  const rows = await prisma.seriesPoint.findMany({
    where: { codigo },
    orderBy: { data: 'desc' },
    take: limit,
    select: { data: true, valor: true },
  });

  return rows.reverse();
}

export interface SeriesFreshness {
  codigo: number;
  syncedAt: Date | null;
  pointCount: number;
  latestData: string | null;
}

/**
 * Idade e volume de cada serie, em uma consulta so.
 *
 * Usado tanto pela revalidacao sob demanda quanto pela tela de Configuracoes.
 * Buscar isso serie a serie seria N consultas para montar um cabecalho.
 */
export async function getFreshness(codigos: number[]): Promise<Map<number, SeriesFreshness>> {
  if (codigos.length === 0) return new Map();

  const grouped = await prisma.seriesPoint.groupBy({
    by: ['codigo'],
    where: { codigo: { in: codigos } },
    _max: { syncedAt: true, data: true },
    _count: { _all: true },
  });

  const result = new Map<number, SeriesFreshness>();
  for (const row of grouped) {
    result.set(row.codigo, {
      codigo: row.codigo,
      syncedAt: row._max.syncedAt ?? null,
      pointCount: row._count._all,
      latestData: row._max.data ?? null,
    });
  }

  return result;
}
