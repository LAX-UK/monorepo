import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = join(__dirname, "../..");

const FORBIDDEN_PATTERNS = [/`£\$\{/, /Asking £/, /Reserve £/, /From £\$\{/];

function listDashboardFiles(dir: string, prefix: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listDashboardFiles(p, prefix));
    } else if (ent.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) {
      out.push(relative(srcRoot, p).replaceAll("\\", "/"));
    }
  }
  return out.filter((rel) => rel.startsWith(prefix.replace(/^src\//, "")));
}

describe("dashboard currency guard", () => {
  it("forbids hardcoded pound symbols in dashboard UI", () => {
    const dirs = [
      { path: join(srcRoot, "components/dashboard"), prefix: "components/dashboard/" },
      { path: join(srcRoot, "app/dashboard"), prefix: "app/dashboard/" },
    ];
    const violations: string[] = [];
    for (const { path, prefix } of dirs) {
      for (const rel of listDashboardFiles(path, prefix)) {
        const content = readFileSync(join(srcRoot, rel), "utf8");
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${rel} matches ${pattern}`);
            break;
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
