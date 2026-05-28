/** Screen-reader message for filtered list result counts. */
export function formatDashboardFilterResults(count: number, entityLabel: string): string {
  if (count === 0) return `No ${entityLabel} match your filters`;
  const noun = count === 1 ? entityLabel.replace(/s$/, "") || entityLabel : entityLabel;
  return `${count} ${noun}`;
}
