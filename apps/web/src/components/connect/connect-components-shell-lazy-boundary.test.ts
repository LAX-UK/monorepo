import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The Connect shell pulls in @stripe/connect-js. It must only be reachable
// through the next/dynamic wrapper so Stripe's script never ships in the
// initial chunk of the payouts page.
const SRC_ROOT = resolve(__dirname, "../..");
const ALLOWED_IMPORTER = "components/connect/connect-components-shell-lazy.tsx";
const SHELL_SPECIFIER = /connect-components-shell(?!-lazy)(?:\.tsx?)?["'`]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|mts|mjs|jsx?)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

describe("connect-components-shell lazy boundary", () => {
  it("is imported only through connect-components-shell-lazy.tsx", () => {
    const offenders = sourceFiles(SRC_ROOT)
      .map((file) => relative(SRC_ROOT, file).split("\\").join("/"))
      .filter((rel) => rel !== ALLOWED_IMPORTER)
      .filter((rel) => rel !== "components/connect/connect-components-shell.tsx")
      .filter((rel) => SHELL_SPECIFIER.test(readFileSync(join(SRC_ROOT, rel), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the lazy wrapper loads the shell with a dynamic import only", () => {
    const source = readFileSync(join(SRC_ROOT, ALLOWED_IMPORTER), "utf8");
    expect(source).toMatch(/dynamic\(/);
    expect(source).not.toMatch(/^import[^;]*connect-components-shell["']/m);
  });
});
