/**
 * Every browser spec runs in exactly one project. A file name pattern that is not anchored can
 * claim a second spec (`buyer-.*` also matched `org-roles-buyer-agent`), and the spec then runs
 * twice against the same seeded data, so the second run fails or hides a bug.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.PLAYWRIGHT_E2E = "1";
// The cataloguer project exists only when its sign-in is configured; routing is checked with it.
process.env.PLAYWRIGHT_CATALOGUE_MANAGER_EMAIL ??= "routing-check";
process.env.PLAYWRIGHT_CATALOGUE_MANAGER_PASSWORD ??= "routing-check";

type Pattern = RegExp | string;
type Project = { name: string; testMatch?: Pattern | Pattern[]; testIgnore?: Pattern | Pattern[] };

const DEFAULT_MATCH: Pattern = /\.(spec|test)\.[cm]?[jt]sx?$/;

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../e2e");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "helpers" ? [] : listFiles(full);
    return entry.isFile() && /\.(spec|setup)\.ts$/.test(entry.name) ? [full] : [];
  });
}

function matches(file: string, patterns: Pattern | Pattern[] | undefined): boolean {
  if (patterns === undefined) return false;
  return [patterns].flat().some((p) => (typeof p === "string" ? file.includes(p) : p.test(file)));
}

const { default: config } = (await import("../playwright.config")) as {
  default: { projects: Project[] };
};

const errors: string[] = [];
for (const file of listFiles(e2eDir)) {
  const owners = config.projects.filter(
    (project) =>
      matches(file, project.testMatch ?? DEFAULT_MATCH) && !matches(file, project.testIgnore),
  );
  const names = owners.map((project) => project.name);
  const relative = path.relative(e2eDir, file);
  const isSetup = relative.endsWith(".setup.ts");
  if (isSetup) continue;
  if (names.length !== 1) {
    errors.push(`${relative}: runs in ${names.length} projects (${names.join(", ") || "none"})`);
  }
}

if (errors.length > 0) {
  console.error(`E2E project routing failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("check-e2e-project-routing: ok");
