import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The identity contracts package root also exports server-only crypto (node:crypto), which breaks
// the browser build. Client components use its "/account" entry instead.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("client bundle imports", () => {
  it("never imports the identity contracts package root from a client component", () => {
    const offenders = sourceFiles(join(__dirname, ".."))
      .filter((file) => readFileSync(file, "utf8").startsWith('"use client"'))
      .filter((file) => /from "@auction\/identity-contracts"/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
