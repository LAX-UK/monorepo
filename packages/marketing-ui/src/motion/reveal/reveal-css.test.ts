import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../marketing-ui.css"),
  "utf8",
);

/** The body of the first `@media <query> { ... }` block whose query starts with `query`. */
function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query}`);
  expect(start, `@media ${query} is missing`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`@media ${query} is not closed`);
}

describe("a reveal that has not played yet", () => {
  it.each(["print", "(prefers-reduced-motion: reduce)"])("is fully visible in %s", (query) => {
    const block = mediaBlock(query);
    expect(block).toContain('.reveal[data-reveal-init="true"]:not([data-revealed="true"])');
    expect(block).toMatch(/opacity:\s*1/);
    expect(block).toMatch(/clip-path:\s*none/);
  });
});
