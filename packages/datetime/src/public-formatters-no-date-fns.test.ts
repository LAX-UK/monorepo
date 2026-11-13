import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = __dirname;

/** Every module `entry` reaches inside this package, and the packages they import. */
function importGraph(entry: string): { files: string[]; packages: Set<string> } {
  const files: string[] = [];
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.includes(file)) continue;
    files.push(file);
    const source = readFileSync(path.join(srcDir, file), "utf8");
    for (const [, specifier] of source.matchAll(/^(?:import|export)[^;]*?from\s+"([^"]+)"/gms)) {
      if (!specifier) continue;
      if (specifier.startsWith("./")) queue.push(specifier.slice(2).replace(/\.js$/, ".ts"));
      else packages.add(specifier);
    }
  }
  return { files, packages };
}

describe("formatters that public pages load", () => {
  // The date and time formatters ship in the first scripts of every public page; date-fns and
  // `@date-fns/tz` must stay with the zone arithmetic in `day-zoned.ts`, which only staff and
  // account code calls. Zone offsets come from `zone-offset.ts` (Intl).
  it.each([
    "date-style.ts",
    "day.ts",
    "describe-moment.ts",
    "device-zone.ts",
    "local-time.ts",
    "offset.ts",
    "runtime-zone.ts",
    "viewer-zone.ts",
    "zone-choices.ts",
    "zone.ts",
  ])("%s imports no date-fns", (entry) => {
    const { packages } = importGraph(entry);
    expect([...packages].filter((name) => name.includes("date-fns"))).toEqual([]);
  });

  it("the zoned arithmetic still comes from date-fns", () => {
    expect(importGraph("day-zoned.ts").packages).toEqual(new Set(["@date-fns/tz", "date-fns"]));
  });
});
