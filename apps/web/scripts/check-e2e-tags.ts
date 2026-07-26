import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TIER_TAGS = ["@smoke", "@journey", "@a11y", "@roles", "@visual", "@optin"] as const;
const describePattern = /test\.describe\s*\(\s*(["'`])([\s\S]*?)\1/g;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(scriptDir, "../e2e");

function listSpecFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSpecFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith(".spec.ts")) return [fullPath];
    return [];
  });
}

function hasTierTag(title: string): boolean {
  return TIER_TAGS.some((tag) => title.includes(tag));
}

const errors: string[] = [];

for (const filePath of listSpecFiles(e2eDir)) {
  const relativePath = path.relative(e2eDir, filePath).replaceAll("\\", "/");
  const source = readFileSync(filePath, "utf8");
  const matches = [...source.matchAll(describePattern)];

  if (matches.length === 0) {
    errors.push(`${relativePath}: no test.describe blocks found`);
    continue;
  }

  for (const match of matches) {
    const title = match[2] ?? "";
    const line = source.slice(0, match.index).split("\n").length;
    if (!hasTierTag(title)) {
      errors.push(`${relativePath}:${line}: missing tier tag in "${title.trim()}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(`E2E tag check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`check-e2e-tags: ok (${TIER_TAGS.join(", ")})`);
