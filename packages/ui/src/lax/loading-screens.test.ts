import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every public loading screen in LAX Bid, LAX Shop and lax.art (docs/design/motion.md, MO12): each
 * route's `loading.tsx` and the components it draws, followed through the app's own imports. A
 * loading screen is the shared skeleton (`.lax-skeleton`, or the kit `Skeleton` that renders it),
 * never its own loop: no Tailwind `animate-pulse`, no shimmer, no spinner. Spinners belong inside
 * buttons only. Bid admin (`app/admin`) is the staff tools and is left to motion PR 7.
 *
 * The behaviour of `.lax-skeleton` itself is proven in Chromium (skeleton-resolved.test.ts).
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const APPS = {
  "LAX Bid": { dir: "apps/web", skip: [`app${sep}admin${sep}`] },
  "LAX Shop": { dir: "apps/shop", skip: [] as string[] },
  "lax.art": { dir: "apps/art", skip: [] as string[] },
} as const;

const BANNED: Array<[RegExp, string]> = [
  [/(?<![\w-])animate-pulse(?![\w-])/, "Tailwind animate-pulse (use the shared skeleton)"],
  [/shimmer/i, "a shimmer"],
  [/animate-spin|Loader2|LoaderCircle|Spinner/, "a page-level spinner"],
  [/@keyframes/, "its own keyframes"],
];

function loadingFiles(dir: string, skip: readonly string[], out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (skip.some((part) => `${full}${sep}`.includes(part))) continue;
    if (statSync(full).isDirectory()) loadingFiles(full, skip, out);
    else if (entry === "loading.tsx") out.push(full);
  }
  return out;
}

const SOURCE_EXT = ["", ".tsx", ".ts", "/index.tsx", "/index.ts"];

/** The app's own modules a file imports (`@/…` and relative); packages are not followed. */
function localImports(file: string, src: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const m of text.matchAll(/(?:import|export)[^"']*?from\s*["']([^"']+)["']/g)) {
    const spec = m[1] as string;
    const base = spec.startsWith("@/")
      ? join(src, spec.slice(2))
      : spec.startsWith(".")
        ? resolve(dirname(file), spec)
        : null;
    if (!base) continue;
    const hit = SOURCE_EXT.map((ext) => base + ext).find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    );
    if (hit) found.push(hit);
  }
  return found;
}

/** A loading screen and everything of the app's own it draws, a few imports deep. */
function screenModules(entry: string, src: string, depth = 3): Set<string> {
  const seen = new Set<string>([entry]);
  let frontier = [entry];
  for (let level = 0; level < depth; level++) {
    const next: string[] = [];
    for (const file of frontier) {
      for (const dep of localImports(file, src)) {
        // Only components and route files draw; lib modules (cookies, chrome constants) do not.
        if (!/[\\/](components|app)[\\/]/.test(dep) || seen.has(dep)) continue;
        seen.add(dep);
        next.push(dep);
      }
    }
    frontier = next;
  }
  return seen;
}

/** The code of a file with comments removed, so a word in a comment does not count. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe.each(Object.entries(APPS))("%s loading screens", (_, { dir, skip }) => {
  const src = join(root, dir, "src");
  const screens = loadingFiles(join(src, "app"), skip);

  it("has loading screens to check", () => {
    expect(screens.length).toBeGreaterThan(0);
  });

  it.each(screens.map((file) => [relative(root, file), file]))(
    "%s uses only the shared skeleton",
    (_name, file) => {
      const offences: string[] = [];
      for (const module of screenModules(file, src)) {
        const text = code(module);
        for (const [pattern, what] of BANNED) {
          if (pattern.test(text)) offences.push(`${relative(root, module)}: ${what}`);
        }
      }
      expect(offences).toEqual([]);
    },
  );
});

describe("the kit skeletons", () => {
  it.each([
    ["components/ui/skeleton.tsx"],
    ["lax/skeleton.tsx"],
    ["components/ui/table-skeleton.tsx"],
    ["components/ui/media-placeholder.tsx"],
    ["lax/sparkline.tsx"],
  ])("%s draws the shared .lax-skeleton and no loop of its own", (path) => {
    const text = code(resolve(dirname(fileURLToPath(import.meta.url)), "..", path));
    expect(text).toMatch(/(?<![\w-])lax-skeleton(?![\w-])/);
    for (const [pattern] of BANNED) expect(text).not.toMatch(pattern);
    expect(text).not.toMatch(/animate-\[/);
  });
});

describe("loading placeholders outside loading.tsx", () => {
  // Loading states drawn inside a page rather than by a route's loading screen; they use the same
  // skeleton. (Other hand-rolled placeholders are a follow-up, listed in motion PR 5.)
  it.each([["apps/web/src/components/connect/connect-components-shell.tsx"]])(
    "%s draws the shared .lax-skeleton and no loop of its own",
    (path) => {
      const text = code(join(root, path));
      expect(text).toMatch(/(?<![\w-])lax-skeleton(?![\w-])/);
      for (const [pattern] of BANNED) expect(text).not.toMatch(pattern);
    },
  );
});
