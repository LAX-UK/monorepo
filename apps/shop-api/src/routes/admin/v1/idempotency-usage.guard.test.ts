import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routesDir = dirname(fileURLToPath(import.meta.url));

/**
 * A call whose result is dropped checks that a key is present but does nothing with it, so a
 * retry runs the write twice. The key has to reach `withAdminIdempotency`.
 */
const DISCARDED_KEY_CALL = /^\s*(?:await\s+)?requireIdempotencyKey\([^)]*\)\s*;?\s*$/m;

describe("admin routes use the idempotency key", () => {
  const files = readdirSync(routesDir).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );

  it("finds the route files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s does not discard the result of requireIdempotencyKey", (file) => {
    const source = readFileSync(join(routesDir, file), "utf8");
    expect(source).not.toMatch(DISCARDED_KEY_CALL);
  });

  it("the pattern catches a bare call", () => {
    expect("      requireIdempotencyKey(request);\n").toMatch(DISCARDED_KEY_CALL);
    expect("      const key = requireIdempotencyKey(request);\n").not.toMatch(DISCARDED_KEY_CALL);
  });
});
