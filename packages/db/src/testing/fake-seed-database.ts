/**
 * A stand-in database for unit tests of the seed guard and the seed CLIs: it answers the queries
 * `readDemoSeedTarget` makes and records every statement, so a test can show that nothing was
 * written. `name` is current_database(); `mark` is the demo_seed_target row, if any.
 */
export function fakeSeedDatabase(options: {
  name: string;
  hasTable?: boolean;
  mark?: { environment: string; database_name: string } | null;
}) {
  const mark = options.mark ?? null;
  const statements: string[] = [];
  const db = {
    async execute(query: { queryChunks?: unknown[] }) {
      const text = JSON.stringify(query.queryChunks ?? query);
      statements.push(text);
      if (text.includes("to_regclass")) {
        return { rows: [{ name: options.name, has_table: options.hasTable ?? true }] };
      }
      if (text.includes("from demo_seed_target")) return { rows: mark ? [mark] : [] };
      return { rows: [] };
    },
  };
  return {
    db,
    statements,
    /** Whether anything other than the guard's reads ran. */
    wrote: () =>
      statements.some((s) => !s.includes("to_regclass") && !s.includes("from demo_seed_target")),
  };
}
