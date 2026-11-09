type LineKey = { id: string; createdAt: Date; framingForLineId: string | null };

/**
 * Puts each frame straight after the print it goes with, and keeps lines otherwise in the order
 * they were made. Lines made together share a created_at, so the database order alone would
 * place a frame before its print at random.
 */
export function printThenFrame<T>(rows: readonly T[], key: (row: T) => LineKey): T[] {
  const byId = new Map(rows.map((row) => [key(row).id, row]));
  const position = (row: T) => {
    const own = key(row);
    const parent = own.framingForLineId ? byId.get(own.framingForLineId) : undefined;
    const anchor = parent ? key(parent) : own;
    return `${anchor.createdAt.toISOString()}|${anchor.id}|${own.framingForLineId ? 1 : 0}`;
  };
  return [...rows].sort((a, b) => position(a).localeCompare(position(b)));
}
