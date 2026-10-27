const TIME_ZONE = 'America/Sao_Paulo';

/** Data (YYYY-MM-DD) no fuso de Brasília. */
export function toBrasiliaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "2026-10-14" -> "14/10/2026" */
export function formatBrazilianDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export const SCHEDULER_TIME_ZONE = TIME_ZONE;
