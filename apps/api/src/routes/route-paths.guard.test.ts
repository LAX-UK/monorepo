import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hono registers a route that has no path string under the path of the route registered
 * before it, so a missing path silently moves a handler to the wrong URL instead of failing.
 * Every registration in the routes tree must therefore start with a path: a string, a
 * template literal or a named constant.
 */
const ROUTES_DIR = new URL(".", import.meta.url).pathname;
const REGISTRATION = /\b\w+\.(get|post|put|patch|delete|all)\(\s*/g;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
}

/** The argument list up to the matching close paren, for a call starting at `open`. */
function callArguments(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return source.slice(open + 1);
}

function pathlessRegistrations(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const match of source.matchAll(REGISTRATION)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf("(");
    const args = callArguments(source, open);
    // Only Hono registrations: their handler receives the request context `c`.
    if (!/\(\s*c\b[^)]*\)\s*=>/.test(args)) continue;
    const first = args.trimStart()[0] ?? "";
    const startsWithConstant = /^[A-Z][A-Z0-9_]*\b/.test(args.trimStart());
    if (first === '"' || first === "'" || first === "`" || startsWithConstant) continue;
    const line = source.slice(0, match.index).split("\n").length;
    found.push(`${relative(ROUTES_DIR, file)}:${line}`);
  }
  return found;
}

describe("route registrations", () => {
  it("always name their path", () => {
    const offenders = routeFiles(ROUTES_DIR).flatMap(pathlessRegistrations);
    expect(offenders).toEqual([]);
  });
});
