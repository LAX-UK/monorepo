import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("middleware theme contract", () => {
  it("applies client hint headers for SSR theme alignment", () => {
    const middlewarePath = join(process.cwd(), "src/middleware.ts");
    const source = readFileSync(middlewarePath, "utf8");
    expect(source).toContain("applyClientHintHeaders");
  });
});
