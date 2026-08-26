/**
 * Conversao entre o formato do BCB e o formato interno.
 *
 * O SGS fala `DD/MM/AAAA`; o resto do sistema fala ISO `AAAA-MM-DD`. Esta
 * fronteira existe num lugar so para que nenhum outro modulo precise saber
 * disso.
 */

/** `DD/MM/AAAA` -> `AAAA-MM-DD`. Devolve `null` se o formato nao bater. */
export function bcbDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

/** `Date` -> `DD/MM/AAAA`, que e o formato aceito nos parametros do SGS. */
export function toBcbDate(date: Date): string {
  const dia = String(date.getUTCDate()).padStart(2, '0');
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${date.getUTCFullYear()}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function minutesSince(instant: Date): number {
  return Math.floor((Date.now() - instant.getTime()) / 60_000);
}

export interface DateWindow {
  start: Date;
  end: Date;
}

/**
 * Quebra um intervalo em janelas de no maximo `maxYears` anos.
 *
 * O endpoint de intervalo do SGS recusa faixas longas com HTTP 406 -- medido:
 * 01/01/2017 a 25/08/2026 responde 200 com 2.420 pontos, e 01/01/2016 ao mesmo
 * fim responde 406. O limite documentado e de 10 anos, entao pedimos em
 * janelas menores que isso e concatenamos. Sem este fatiamento, carregar o
 * historico de uma serie diaria simplesmente falha.
 */
export function splitIntoWindows(start: Date, end: Date, maxYears = 9): DateWindow[] {
  const windows: DateWindow[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const windowEnd = new Date(cursor);
    windowEnd.setUTCFullYear(windowEnd.getUTCFullYear() + maxYears);

    windows.push({
      start: new Date(cursor),
      end: windowEnd < end ? windowEnd : new Date(end),
    });

    // Avanca um dia alem do fim da janela para nao repetir a data de fronteira.
    cursor = new Date(windowEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return windows;
}

/** Data de inicio do backfill: `years` anos antes de hoje. */
export function yearsAgo(years: number): Date {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date;
}
