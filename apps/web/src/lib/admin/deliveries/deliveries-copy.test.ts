import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DELIVERIES_COPY } from "./deliveries-copy";

/** The Deliveries screen's own code, tests left out: where every word must be read. */
const SOURCES = [
  "src/lib/admin/deliveries",
  "src/components/admin/deliveries",
  "src/app/admin/(platform)/deliveries",
]
  .flatMap((dir) =>
    readdirSync(path.resolve(dir))
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) => file !== "deliveries-copy.ts" && !file.endsWith(".fixture.ts"))
      .map((file) => readFileSync(path.resolve(dir, file), "utf8")),
  )
  .join("\n");

/** Tables read by a status or event the code holds, e.g. `DELIVERIES_COPY.views[id]`. */
const KEYED = ["views", "badges", "since", "empty", "history", "actors"] as const;

function leaves(value: unknown, prefix: string[] = []): string[][] {
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, [...prefix, key]));
  }
  return [prefix];
}

function isRead(keys: string[]): boolean {
  const [top, ...rest] = keys;
  if (top && (KEYED as readonly string[]).includes(top)) {
    // A keyed table is read whole, by the union its keys are checked against at build time.
    return (
      SOURCES.includes(`.${top}[`) || (top === "badges" && SOURCES.includes(`BADGE.${rest[0]}`))
    );
  }
  if (rest.length === 0) return SOURCES.includes(`DELIVERIES_COPY.${top}`);
  // The panel reads its own words through `const COPY = DELIVERIES_COPY.panel`.
  if (top === "panel" && SOURCES.includes(`COPY.${rest.join(".")}`)) return true;
  const parent = keys.at(-2);
  const key = keys.at(-1);
  return SOURCES.includes(`.${parent}.${key}`);
}

describe("DELIVERIES_COPY", () => {
  it("has no words nothing reads", () => {
    const unread = leaves(DELIVERIES_COPY)
      .filter((keys) => !isRead(keys))
      .map((keys) => keys.join("."));
    expect(unread).toEqual([]);
  });

  it("finds a key nothing reads", () => {
    expect(isRead(["panel", "nothingReadsThis"])).toBe(false);
    expect(isRead(["panel", "notFound", "back"])).toBe(true);
  });
});
