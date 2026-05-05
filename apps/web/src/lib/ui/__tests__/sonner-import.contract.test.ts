import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "../../../..");
const srcRoot = join(webRoot, "src");

/** ESM/CJS import of the sonner package (not string literals like vi.mock("sonner")). */
const SONNER_IMPORT = /from\s+["']sonner["']/;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listTsFiles(p));
    } else if (ent.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) {
      out.push(p);
    }
  }
  return out;
}

describe("sonner import contract (apps/web)", () => {
  it("only src/lib/ui/notify.ts imports sonner", () => {
    const violations: string[] = [];
    for (const file of listTsFiles(srcRoot)) {
      const rel = relative(webRoot, file).replaceAll("\\", "/");
      if (rel === "src/lib/ui/notify.ts") {
        continue;
      }
      if (SONNER_IMPORT.test(readFileSync(file, "utf8"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
