/**
 * Strict argv parsing shared by the backfill scripts. Unknown flags, repeated flags and flags
 * with no value throw, so a typo such as `--aply` can never silently fall back to a dry run.
 * A bare `--` is skipped: pnpm passes the separator in `pnpm --filter ... -- --apply` through.
 */
export function collectFlags(
  argv: readonly string[],
  valueFlags: readonly string[],
): { apply: boolean; values: Map<string, string> } {
  const expected = ["--apply", ...valueFlags.map((name) => `--${name}=...`)].join(", ");
  let apply = false;
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--apply") {
      if (apply) throw new Error("--apply was given more than once");
      apply = true;
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/s.exec(arg);
    const name = match?.[1];
    if (!match || name === undefined || !valueFlags.includes(name)) {
      throw new Error(`Unknown argument "${arg}" (expected ${expected})`);
    }
    if (values.has(name)) throw new Error(`--${name} was given more than once`);
    const value = match[2] ?? "";
    if (value === "") throw new Error(`--${name} needs a value (--${name}=...)`);
    values.set(name, value);
  }
  return { apply, values };
}
