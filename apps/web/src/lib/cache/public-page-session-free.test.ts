import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * CO-7: the session-free API reads behind the public sale and lot pages are shared between
 * visitors (the Data Cache, by item tag). The HTML itself is not: it is rendered per request,
 * because the root layout reads the visitor's session, cookies and CSP nonce into the same HTML.
 * So the route's own server render must not read the session or the cookies (or a shared read
 * could carry one visitor's data), and nothing may make the HTML itself cacheable (a route-level
 * `revalidate`, `force-static`, static params or a CDN header rule), or one visitor's layout would
 * be served to others. The second half of this file holds that.
 * This walks every module the route's
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

/*
 * The HTML stays per request: the route segments and every layout above them (the root layout,
 * the marketing group) export nothing that would cache or pre-render it, the root layout still
 * reads request state (what makes the route dynamic, and why its HTML must never be shared), and
 * next.config adds no cache header for these paths.
 */
const ROOT_LAYOUTS = ["app/layout.tsx", "app/(marketing)/layout.tsx"];

/** Exports that would cache the HTML or render it ahead of a request. */
const STATIC_HTML_EXPORTS = [
  /export\s+const\s+revalidate\s*=/,
  /export\s+const\s+dynamic\s*=\s*["'](?:force-static|error)["']/,
  /export\s+(?:async\s+)?function\s+generateStaticParams\b/,
  /export\s+const\s+fetchCache\s*=\s*["'](?:force-cache|only-cache|default-cache)["']/,
];

/** Every route file from the app root down to the route's own folder. */
function segmentFiles(dir: string): string[] {
  const files = [...ROOT_LAYOUTS];
  const parts = dir.split("/");
  for (let i = 2; i <= parts.length; i++) {
    const folder = parts.slice(0, i).join("/");
    for (const f of ["layout.tsx", "page.tsx", "template.tsx", "loading.tsx"]) {
      const file = `${folder}/${f}`;
      if (!files.includes(file) && existsSync(join(SRC, file))) files.push(file);
    }
  }
  return files;
}

function staticHtmlExports(files: string[]): string[] {
  return files.flatMap((file) => {
    const source = readFileSync(join(SRC, file), "utf8");
    return STATIC_HTML_EXPORTS.filter((re) => re.test(source)).map((re) => `${file}: ${re}`);
  });
}

describe.each(ROUTES)("public $name page HTML is per request (CO-7)", ({ dir }) => {
  it("is checked for real: the chain covers the root layout and the route's page", () => {
    const files = segmentFiles(dir);
    expect(files).toContain("app/layout.tsx");
    expect(files).toContain(`${dir}/page.tsx`);
  });

  it("exports nothing from the route or its layouts that caches or pre-renders the HTML", () => {
    expect(staticHtmlExports(segmentFiles(dir))).toEqual([]);
  });
});

describe("what keeps the HTML per request", () => {
  it("the root layout reads request state (session, cookies, nonce)", () => {
    const source = readFileSync(join(SRC, "app/layout.tsx"), "utf8");
    expect(source).toMatch(/from\s+["']next\/headers["']/);
  });

  it("next.config adds no cache header for the sale and lot pages", () => {
    const config = readFileSync(resolve(SRC, "../next.config.ts"), "utf8");
    expect(config).not.toMatch(/source:\s*["']\/(?:sales|lot)\b/);
    expect(config).not.toMatch(/cacheHandler/);
  });

  it("the check catches a route-level revalidate", () => {
    expect(STATIC_HTML_EXPORTS.some((re) => re.test("export const revalidate = 60;"))).toBe(true);
    expect(
      STATIC_HTML_EXPORTS.some((re) => re.test('export const dynamic = "force-static";')),
    ).toBe(true);
  });
});
