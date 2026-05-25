import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type DarkModeSuspect = {
  file: string;
  line: number;
  token: string;
  classString: string;
};

const SUSPECT_PATTERNS: Array<{ test: (token: string) => boolean; darkPrefix: string }> = [
  {
    test: (token) => token === "bg-white" || token.startsWith("bg-white/"),
    darkPrefix: "dark:bg-",
  },
  {
    test: (token) => /^text-\[#/.test(token),
    darkPrefix: "dark:text-",
  },
  {
    test: (token) => /^border-\[#/.test(token),
    darkPrefix: "dark:border-",
  },
  {
    test: (token) => /^bg-\[#/.test(token),
    darkPrefix: "dark:bg-",
  },
];

const SEMANTIC_TOKEN_PREFIXES = [
  "bg-page-bg",
  "bg-surface",
  "text-on-surface",
  "border-nav-border",
  "text-brand-",
  "bg-brand-",
  "border-brand-",
];

function isSemanticToken(token: string): boolean {
  return SEMANTIC_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function hasDarkPair(classString: string, darkPrefix: string): boolean {
  return classString.split(/\s+/).some((token) => token.startsWith(darkPrefix));
}

function findSuspectsInClassString(classString: string): string[] {
  const tokens = classString.split(/\s+/).filter(Boolean);
  const suspects: string[] = [];

  for (const token of tokens) {
    if (isSemanticToken(token)) continue;

    for (const { test, darkPrefix } of SUSPECT_PATTERNS) {
      if (test(token) && !hasDarkPair(classString, darkPrefix)) {
        suspects.push(token);
        break;
      }
    }
  }

  return suspects;
}

/** Extract Tailwind class strings from a TSX/TS source line. */
export function extractClassStringsFromLine(line: string): string[] {
  const results: string[] = [];

  for (const match of line.matchAll(/className="([^"]+)"/g)) {
    if (match[1]) results.push(match[1]);
  }

  for (const match of line.matchAll(/className=\{[`'"]([^`'"]+)[`'"]\}/g)) {
    if (match[1]) results.push(match[1]);
  }

  for (const match of line.matchAll(/className=\{\s*[`'"]([^`'"]+)[`'"]\s*\}/g)) {
    if (match[1]) results.push(match[1]);
  }

  for (const match of line.matchAll(/\bcn\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    if (match[1]) results.push(match[1]);
  }

  for (const match of line.matchAll(/,\s*[`'"]([^`'"]+)[`'"]\s*[),]/g)) {
    const value = match[1];
    if (value && /(?:bg-|text-|border-)/.test(value)) {
      results.push(value);
    }
  }

  return results;
}

export function auditFileContent(
  filePath: string,
  content: string,
  repoRoot: string,
): DarkModeSuspect[] {
  const relativePath = relative(repoRoot, filePath).replace(/\\/g, "/");
  const suspects: DarkModeSuspect[] = [];
  const lines = content.split("\n");
  const seen = new Set<string>();

  const recordSuspects = (classString: string, line: number) => {
    const key = `${line}:${classString}`;
    if (seen.has(key)) return;
    seen.add(key);

    for (const token of findSuspectsInClassString(classString)) {
      suspects.push({
        file: relativePath,
        line,
        token,
        classString,
      });
    }
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line) continue;

    for (const classString of extractClassStringsFromLine(line)) {
      recordSuspects(classString, index + 1);
    }
  }

  for (const match of content.matchAll(/\bcn\s*\(([\s\S]*?)\)/g)) {
    const block = match[1];
    if (!block) continue;
    const line = content.slice(0, match.index).split("\n").length;
    for (const strMatch of block.matchAll(/[`'"]([^`'"]+)[`'"]/g)) {
      if (strMatch[1]) recordSuspects(strMatch[1], line);
    }
  }

  for (const match of content.matchAll(
    /const\s+[A-Z0-9_]+\s*=\s*\n?\s*[`'"]([^`'"]*(?:bg-|text-|border-)[^`'"]*)[`'"]/g,
  )) {
    const classString = match[1];
    if (!classString) continue;
    const line = content.slice(0, match.index).split("\n").length;
    recordSuspects(classString, line);
  }

  return suspects;
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (/\.tsx?$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

export function defaultScanRoots(repoRoot: string): string[] {
  return [join(repoRoot, "apps/web/src"), join(repoRoot, "packages/ui/src")];
}

export function loadExemptions(repoRoot: string): Set<string> {
  const path = join(repoRoot, "apps/web/src/lib/theme/dark-mode-exemptions.json");
  const raw = readFileSync(path, "utf8");
  const entries = JSON.parse(raw) as string[];
  return new Set(entries);
}

export function auditDarkMode(options: {
  repoRoot: string;
  scanRoots?: string[];
  exemptions?: Set<string>;
}): DarkModeSuspect[] {
  const scanRoots = options.scanRoots ?? defaultScanRoots(options.repoRoot);
  const exemptions = options.exemptions ?? loadExemptions(options.repoRoot);
  const allSuspects: DarkModeSuspect[] = [];

  for (const root of scanRoots) {
    for (const file of walk(root)) {
      if (!file.endsWith(".tsx")) continue;
      const relativePath = relative(options.repoRoot, file).replace(/\\/g, "/");
      if (exemptions.has(relativePath)) continue;
      if (relativePath.includes(".test.")) continue;

      const content = readFileSync(file, "utf8");
      allSuspects.push(...auditFileContent(file, content, options.repoRoot));
    }
  }

  return allSuspects;
}

export function groupSuspectsByDirectory(
  suspects: DarkModeSuspect[],
): Map<string, DarkModeSuspect[]> {
  const groups = new Map<string, DarkModeSuspect[]>();

  for (const suspect of suspects) {
    const parts = suspect.file.split("/");
    let key = parts.slice(0, 3).join("/");
    if (suspect.file.includes("packages/ui")) {
      key = "packages/ui";
    } else if (suspect.file.includes("components/layout")) {
      key = "layout";
    } else if (suspect.file.includes("components/auth")) {
      key = "auth";
    } else if (suspect.file.includes("components/admin")) {
      key = "admin";
    } else if (suspect.file.includes("components/marketing")) {
      key = "marketing";
    } else if (suspect.file.includes("sections/home")) {
      key = "sections/home";
    } else if (suspect.file.includes("sections/artwork")) {
      key = "sections/artwork";
    } else if (suspect.file.includes("sections/saleroom")) {
      key = "sections/saleroom";
    }

    const bucket = groups.get(key) ?? [];
    bucket.push(suspect);
    groups.set(key, bucket);
  }

  return groups;
}

export function formatAuditReport(suspects: DarkModeSuspect[]): string {
  if (suspects.length === 0) {
    return "# Dark mode audit\n\nNo unpaired light-only class suspects found.\n";
  }

  const groups = groupSuspectsByDirectory(suspects);
  const lines = ["# Dark mode audit", "", `Total suspects: ${suspects.length}`, ""];

  for (const [group, items] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`## ${group}`, "");
    for (const item of items) {
      lines.push(
        `- \`${item.file}:${item.line}\` — \`${item.token}\` in \`${item.classString.slice(0, 80)}${item.classString.length > 80 ? "…" : ""}\``,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function runAuditCli(): number {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");
  const suspects = auditDarkMode({ repoRoot });
  const report = formatAuditReport(suspects);
  console.log(report);
  return suspects.length > 0 ? 1 : 0;
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  process.exitCode = runAuditCli();
}
