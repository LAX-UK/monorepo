import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "../../../../..");
const globalsCss = readFileSync(join(repoRoot, "apps/web/src/app/globals.css"), "utf8");
const tokensDarkCss = readFileSync(join(repoRoot, "apps/web/src/styles/tokens-dark.css"), "utf8");

const SHELL_TOKEN_PATTERN =
  /--color-(?:shell-[a-z-]+|info(?:-container)?|nav-active-(?:bg|border)):\s*[^;]+;/g;

function extractTokenNames(css: string): string[] {
  const names: string[] = [];
  for (const match of css.matchAll(SHELL_TOKEN_PATTERN)) {
    const name = match[0].match(/--color-[a-z-]+/)?.[0];
    if (name) names.push(name);
  }
  return [...new Set(names)];
}

describe("shell theme token parity", () => {
  it("defines dark overrides for every shell chrome token in globals.css", () => {
    const lightTokens = extractTokenNames(globalsCss);
    expect(lightTokens.length).toBeGreaterThan(0);

    const darkBlock = tokensDarkCss.match(/html\.dark\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    const missing = lightTokens.filter((token) => !darkBlock.includes(`${token}:`));

    expect(missing, `Missing dark overrides: ${missing.join(", ")}`).toEqual([]);
  });
});
