import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * CO-7: the public sale and lot pages are rendered once for everyone, so they can be cached. Their
 * server render must not read the session or the cookies. This walks every module the route's
 * server render can load (its page, layout, loading shell and metadata) and fails when one of them
 * reads request state.
 *
 * The walk stops at a "use client" module (it runs in the browser and cannot read cookies on the
 * server) and at the one module allowed to read the session: the staff preview of a sale or lot
 * the public cannot see, which is only reached after the public read answered 404.
 */

const SRC = resolve(__dirname, "../..");

/** Server modules that read request state. */
const FORBIDDEN_IMPORTS = ["next/headers"];

/** Read the session after a public 404 only; its render is personal and never cached. */
const ALLOWED_SESSION_MODULES = new Set(["lib/marketing/staff-catalogue-preview.server.ts"]);

const IMPORT_RE =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;

function resolveModule(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/.test(source);
}

/** Every server module reachable from the entries, and each forbidden import found on the way. */
function walk(entries: string[]) {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const stack = entries.map((e) => join(SRC, e));
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const rel = relative(SRC, file);
    const source = readFileSync(file, "utf8");
    if (isClientModule(source) || ALLOWED_SESSION_MODULES.has(rel)) continue;
    // Type-only imports and re-exports never run.
    const runtime = source.replace(/^(?:import|export)\s+type\s[^;]+;/gm, "");
    for (const match of runtime.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;
      if (FORBIDDEN_IMPORTS.includes(spec)) {
        offenders.push(`${rel} imports ${spec}`);
        continue;
      }
      const next = resolveModule(spec, file);
      if (next && !next.endsWith(".test.ts") && !next.endsWith(".test.tsx")) stack.push(next);
    }
  }
  return { seen, offenders };
}

const ROUTES = [
  {
    name: "sale",
    dir: "app/(marketing)/sales/[slug]/[id]",
    loader: "lib/marketing/load-saleroom-detail-page.ts",
  },
  {
    name: "lot",
    dir: "app/(marketing)/lot/[slug]/[id]",
    loader: "lib/marketing/load-lot-detail-page.ts",
  },
] as const;

describe.each(ROUTES)("public $name page render (CO-7)", ({ dir, loader }) => {
  const entries = ["page.tsx", "layout.tsx", "loading.tsx", "opengraph-image.tsx"]
    .map((f) => `${dir}/${f}`)
    .filter((f) => existsSync(join(SRC, f)));

  it("reads neither the session nor the cookies", () => {
    const { offenders } = walk(entries);
    expect(offenders).toEqual([]);
  });

  it("reaches the session only through the staff preview of an item the public cannot see", () => {
    const rel = [...walk(entries).seen].map((f) => relative(SRC, f));
    expect(rel).not.toContain("lib/data/http/session.server.ts");
    expect(rel).toContain("lib/marketing/staff-catalogue-preview.server.ts");
  });

  it("is checked for real: the walk sees the page's loader and the public reads", () => {
    const rel = [...walk(entries).seen].map((f) => relative(SRC, f));
    expect(rel).toContain(loader);
    expect(rel).toContain("lib/data/http/public-catalogue.server.ts");
  });
});

describe("the walk itself", () => {
  it("finds a cookie read in a known personal route", () => {
    const { offenders } = walk(["app/api/me/menu-context/route.ts"]);
    expect(offenders.length).toBeGreaterThan(0);
  });
});
