import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  clientBoundaryViolations,
  clientOnlyExports,
  serverAsChildViolations,
  serverImportViolations,
} from "./check-client-boundary.mjs";

/** A tiny package: a client module with a component, a hook, a formatter and a constant. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "client-boundary-"));
  mkdirSync(join(dir, "lib"));
  writeFileSync(
    join(dir, "tabs.tsx"),
    `"use client";\nexport function Tabs() { return null; }\nexport function useTabs() {}\nexport function formatThing(n: number) { return String(n); }\nexport const THING_LIMIT = 3;\n`,
  );
  writeFileSync(
    join(dir, "lib", "count.ts"),
    "export function formatCount(n: number) { return String(n); }\n",
  );
  writeFileSync(join(dir, "plain.ts"), 'export { formatThing } from "./tabs.js";\n');
  writeFileSync(
    join(dir, "index.ts"),
    [
      'export { Tabs, useTabs, THING_LIMIT } from "./tabs.js";',
      'export type { TabsProps } from "./tabs.js";',
      'export { formatCount } from "./lib/count.js";',
      'export { formatThing as format } from "./plain.js";',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "server-page.tsx"),
    'import { Tabs, format, formatCount } from "@pkg";\nexport default function Page() { return Tabs; }\n',
  );
  writeFileSync(
    join(dir, "client-page.tsx"),
    '"use client";\nimport { format } from "@pkg";\nexport const x = format;\n',
  );
  return dir;
}

describe("check-client-boundary", () => {
  it("lets components and hooks through, and finds values from client modules, through plain re-exports too", () => {
    const dir = fixture();
    assert.deepEqual(
      clientOnlyExports(join(dir, "index.ts"))
        .map(({ name }) => name)
        .sort(),
      ["THING_LIMIT", "format"],
    );
    assert.equal(clientBoundaryViolations(join(dir, "index.ts")).length, 2);
  });

  it("treats every export of a server-safe entry from a client module as a violation", () => {
    const dir = fixture();
    assert.equal(clientBoundaryViolations(join(dir, "index.ts"), { serverSafe: true }).length, 4);
  });

  it("flags a server module calling a client-only value, and leaves client modules alone", () => {
    const dir = fixture();
    const clientOnly = new Map([["@pkg", new Set(["format", "THING_LIMIT"])]]);
    const lines = serverImportViolations(
      [join(dir, "server-page.tsx"), join(dir, "client-page.tsx")],
      clientOnly,
    );
    assert.equal(lines.length, 1);
    assert.match(lines[0], /server-page\.tsx: imports format from @pkg/);
  });

  it("flags Button asChild in a server module, and not in a client one", () => {
    const dir = fixture();
    writeFileSync(
      join(dir, "server-cta.tsx"),
      'import { Button } from "@auction/ui/lax";\nexport const Cta = () => <Button asChild variant="primary"><a href="/x">Go</a></Button>;\n',
    );
    writeFileSync(
      join(dir, "client-cta.tsx"),
      '"use client";\nimport { Button } from "@auction/ui/lax";\nexport const Cta = () => <Button asChild><a href="/x">Go</a></Button>;\n',
    );
    const lines = serverAsChildViolations([
      join(dir, "server-cta.tsx"),
      join(dir, "client-cta.tsx"),
    ]);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /server-cta\.tsx: <Button asChild>/);
  });
});
