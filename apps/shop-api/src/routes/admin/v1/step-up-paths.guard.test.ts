import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHOP_ADMIN_STEP_UP_PATHS,
  isStepUpPath,
  stepUpPatternMatches,
} from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";

const routesDir = dirname(fileURLToPath(import.meta.url));
const ROUTE_START = /app\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

/** Every route whose handler requires a recent sign-in, as `METHOD /admin/v1/path`. */
function routesRequiringStepUp(): string[] {
  const found: string[] = [];
  const files = readdirSync(routesDir).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  );
  for (const file of files) {
    const source = readFileSync(join(routesDir, file), "utf8");
    const starts = [...source.matchAll(ROUTE_START)];
    starts.forEach((start, index) => {
      const end = starts[index + 1]?.index ?? source.length;
      const block = source.slice(start.index ?? 0, end);
      if (block.includes("requireRecentAuthentication(")) {
        found.push(`${(start[1] ?? "").toUpperCase()} /admin/v1${start[2]}`);
      }
    });
  }
  return found;
}

describe("shop-api step-up routes match the shared list", () => {
  const routes = routesRequiringStepUp();

  it("finds the step-up routes", () => {
    expect(routes.length).toBeGreaterThan(8);
  });

  it.each(routes)("%s is on the shared list the BFF uses", (route) => {
    const [method, path] = route.split(" ") as [string, string];
    expect(method).not.toBe("GET");
    expect(isStepUpPath(path)).toBe(true);
  });

  it.each([...SHOP_ADMIN_STEP_UP_PATHS])("%s is enforced by a shop-api route", (pattern) => {
    const enforced = routes.some((route) =>
      stepUpPatternMatches(pattern, route.split(" ")[1] ?? ""),
    );
    expect(enforced).toBe(true);
  });
});
