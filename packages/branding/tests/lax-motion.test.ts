import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The motion tokens (docs/design/motion.md, MO1) are defined once in lax-system.css, with the
 * staff durations under the staff kit scope. Bid, Shop and lax.art keep their older `--motion-*`
 * names as aliases of them. These checks keep the copies from drifting and prove that every alias
 * still resolves to the value it had before the tokens existed.
 */
const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
const system = read("../public/lax-system.css");
const staffTheme = read("../../staff-ui/src/theme.css");
const PRODUCTS = {
  Bid: read("../../../apps/web/src/app/globals.css"),
  Shop: read("../../../apps/shop/src/app/base.css"),
  "lax.art": read("../../../apps/art/src/app/base.css"),
} as const;

/** Every `--name: value;` declaration whose name starts with `prefix`, comments removed. */
function declarations(source: string, prefix: string): Map<string, string> {
  const map = new Map<string, string>();
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(new RegExp(`(${prefix}[\\w-]*)\\s*:\\s*([^;]+);`, "g"))) {
    map.set(m[1] as string, (m[2] as string).replace(/\s+/g, " ").trim());
  }
  return map;
}

const PUBLIC = {
  "--lax-motion-press": "100ms",
  "--lax-motion-hover": "150ms",
  "--lax-motion-enter": "200ms",
  "--lax-motion-exit": "140ms",
  "--lax-motion-fade": "120ms",
  "--lax-motion-panel": "260ms",
  "--lax-motion-panel-exit": "180ms",
  "--lax-motion-lift": "300ms",
  "--lax-motion-page-out": "140ms",
  "--lax-motion-page-in": "200ms",
  "--lax-motion-morph": "360ms",
  "--lax-motion-media": "700ms",
  "--lax-ease-out": "cubic-bezier(0.2, 0, 0, 1)",
  "--lax-ease-in": "cubic-bezier(0.3, 0, 1, 1)",
  "--lax-ease-emphasize": "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

const STAFF = {
  "--lax-motion-press": "0ms",
  "--lax-motion-hover": "100ms",
  "--lax-motion-enter": "150ms",
  "--lax-motion-exit": "100ms",
  "--lax-motion-fade": "100ms",
  "--lax-motion-panel": "200ms",
  "--lax-motion-panel-exit": "150ms",
  "--lax-motion-page-out": "100ms",
  "--lax-motion-page-in": "150ms",
} as const;

/** What each product's `--motion-*` token computed to before the aliases (must not change). */
const BEFORE: Record<keyof typeof PRODUCTS, Record<string, string>> = {
  Bid: {
    "--motion-duration-xs": "120ms",
    "--motion-duration-sm": "200ms",
    "--motion-duration-md": "320ms",
    "--motion-duration-lg": "520ms",
    "--motion-duration-xl": "900ms",
    "--motion-duration-2xl": "1600ms",
    "--motion-duration-pulse": "1600ms",
    "--motion-ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
    "--motion-ease-emphasize": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--motion-ease-decelerate": "cubic-bezier(0, 0, 0, 1)",
    "--motion-ease-accelerate": "cubic-bezier(0.3, 0, 1, 1)",
  },
  Shop: {
    "--motion-duration-sm": "200ms",
    "--motion-duration-md": "320ms",
    "--motion-duration-lg": "520ms",
    "--motion-duration-xl": "900ms",
    "--motion-ease-emphasize": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--motion-ease-decelerate": "cubic-bezier(0, 0, 0, 1)",
  },
  "lax.art": {
    "--motion-duration-sm": "200ms",
    "--motion-duration-md": "320ms",
    "--motion-duration-lg": "520ms",
    "--motion-duration-xl": "900ms",
    "--motion-ease-emphasize": "cubic-bezier(0.16, 1, 0.3, 1)",
    "--motion-ease-decelerate": "cubic-bezier(0, 0, 0, 1)",
  },
};

/** Resolves `var(--x)` chains against the public layer, the way the browser does at :root. */
function resolve(value: string, scope: ReadonlyMap<string, string>, depth = 0): string {
  if (depth > 5) throw new Error(`alias chain too deep: ${value}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  if (!ref) return value;
  const target = scope.get(ref[1] as string);
  if (target === undefined) throw new Error(`${value} points at a token that is not defined`);
  return resolve(target, scope, depth + 1);
}

describe("LAX motion tokens", () => {
  const tokens = declarations(system, "--lax-(?:motion|ease)");

  it("defines exactly the public set", () => {
    expect(Object.fromEntries(tokens)).toEqual(PUBLIC);
  });

  it("gives the staff scope only shorter durations, never different easings", () => {
    const staff = declarations(staffTheme, "--lax-(?:motion|ease)");
    expect(Object.fromEntries(staff)).toEqual(STAFF);
    for (const [name, value] of staff) {
      expect(Number.parseInt(value, 10)).toBeLessThanOrEqual(
        Number.parseInt(PUBLIC[name as keyof typeof PUBLIC], 10),
      );
    }
  });
});

describe.each(Object.entries(PRODUCTS))("%s --motion-* tokens", (product, css) => {
  const own = declarations(css, "--motion-");
  const before = BEFORE[product as keyof typeof PRODUCTS];
  const scope = new Map([...declarations(system, "--lax-"), ...own]);

  it("declares the same names as before", () => {
    expect([...own.keys()].sort()).toEqual(Object.keys(before).sort());
  });

  it.each(Object.entries(before))("%s still resolves to %s", (name, expected) => {
    expect(resolve(own.get(name) as string, scope)).toBe(expected);
  });

  it("aliases every value that has a shared token instead of copying it", () => {
    const shared = new Set(Object.values(PUBLIC));
    for (const [name, value] of own) {
      if (shared.has(value as (typeof PUBLIC)[keyof typeof PUBLIC])) {
        throw new Error(`${product} ${name} copies ${value}; alias the --lax-* token instead`);
      }
    }
  });
});

describe("declared once", () => {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const SKIP = new Set(["node_modules", "dist", ".next", ".turbo", "coverage"]);
  const allowed = new Set([
    "packages/branding/public/lax-system.css",
    "packages/staff-ui/src/theme.css",
  ]);

  function cssFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) cssFiles(full, out);
      else if (entry.name.endsWith(".css")) out.push(full);
    }
    return out;
  }

  it("declares --lax-motion-* and --lax-ease-* only in lax-system.css and the staff theme", () => {
    const offenders: string[] = [];
    for (const top of ["apps", "packages"]) {
      for (const file of cssFiles(join(root, top))) {
        const path = relative(root, file).split(sep).join("/");
        if (allowed.has(path)) continue;
        const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        if (/(?<![\w-])--lax-(?:motion|ease)-[\w-]*\s*:/.test(text)) offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });
});
