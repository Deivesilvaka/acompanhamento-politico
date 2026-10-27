/**
 * Escapa curingas do LIKE/ILIKE (% e _) vindos do usuário. O valor continua
 * indo como parâmetro da query — isso só impede buscas "match-all" caras.
 */
export function toContainsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
