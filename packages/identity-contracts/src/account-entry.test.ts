import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatDeviceLabel } from "./account.js";

const SRC = dirname(fileURLToPath(import.meta.url));

/** Every module the browser-safe entry reaches, following relative imports and re-exports. */
function reachableFrom(entry: string): Map<string, string> {
  const seen = new Map<string, string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    const source = readFileSync(file, "utf8");
    seen.set(file, source);
    for (const match of source.matchAll(/from\s+"(\.[^"]+)\.js"/g)) {
      visit(resolve(dirname(file), `${match[1]}.ts`));
    }
  };
  visit(entry);
  return seen;
}

describe("the browser-safe Account entry", () => {
  it("exposes the device label Account's client components use", () => {
    expect(formatDeviceLabel("Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36")).toBe(
      "Chrome on macOS",
    );
  });

  it("reaches no Node-only module, so a client bundle can import it", () => {
    for (const [file, source] of reachableFrom(resolve(SRC, "account.ts"))) {
      expect(source, file).not.toMatch(/from\s+"node:/);
    }
  });
});
