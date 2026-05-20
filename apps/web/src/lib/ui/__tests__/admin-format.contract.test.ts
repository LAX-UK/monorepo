import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "../../../..");
const srcRoot = join(webRoot, "src");

const FORBIDDEN_PATTERNS = [
  /\.toLocaleString\s*\(/,
  /new\s+Intl\.NumberFormat/,
  /new\s+Intl\.DateTimeFormat/,
  /new\s+Intl\.RelativeTimeFormat/,
];

const ALLOWLIST = new Set([
  "src/lib/ui/format.ts",
  "src/lib/format-currency.ts",
  "src/components/admin/admin-sale-form.tsx",
]);

function listAdminTsFiles(dir: string, prefix: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listAdminTsFiles(p, prefix));
    } else if (ent.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx"))) {
      const rel = relative(webRoot, p).replaceAll("\\", "/");
      if (rel.startsWith(prefix)) out.push(rel);
    }
  }
  return out;
}

describe("admin format contract (apps/web)", () => {
  it("forbids raw Intl/toLocaleString in app/admin and components/admin", () => {
    const dirs = [
      { path: join(srcRoot, "app/admin"), prefix: "src/app/admin/" },
      { path: join(srcRoot, "components/admin"), prefix: "src/components/admin/" },
    ];
    const violations: string[] = [];
    for (const { path, prefix } of dirs) {
      for (const rel of listAdminTsFiles(path, prefix)) {
        if (ALLOWLIST.has(rel)) continue;
        const content = readFileSync(join(webRoot, rel), "utf8");
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
