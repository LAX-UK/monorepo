/**
 * One-shot F3: rewrite apps/** imports from @auction/persistence root barrel to subpaths.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const persistenceSrc = join(root, "packages/persistence/src");

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", "coverage"]);
const ROOT_SPECIFIER = "@auction/persistence";
const IMPORT_RE =
  /import\s+(type\s+)?(\*\s+as\s+\w+\s+from\s+|(\{[^}]*\})\s+from\s+)["']@auction\/persistence["'];?/g;
const EXPORT_FROM_RE = /export\s+(type\s+)?(\{[^}]*\})\s+from\s+["']@auction\/persistence["'];?/g;

/** @param {string} content @returns {Set<string>} */
function parseNamedExports(content) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const match of content.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const part of match[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const name = trimmed
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim();
      if (name) names.add(name);
    }
  }
  for (const match of content.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)/g)) {
    names.add(match[1]);
  }
  for (const match of content.matchAll(/export\s+interface\s+(\w+)/g)) {
    names.add(match[1]);
  }
  for (const match of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    names.add(match[1]);
  }
  for (const match of content.matchAll(/export\s+const\s+(\w+)/g)) {
    names.add(match[1]);
  }
  return names;
}

/** @type {Map<string, "interfaces"|"repositories"|"lib">} */
const symbolToSubpath = new Map();
for (const [file, subpath] of [
  ["interfaces/index.ts", "interfaces"],
  ["repositories/index.ts", "repositories"],
  ["lib/index.ts", "lib"],
]) {
  const content = readFileSync(join(persistenceSrc, file), "utf8");
  for (const name of parseNamedExports(content)) {
    symbolToSubpath.set(name, subpath);
  }
}

/** @param {string} rel @returns {"interfaces"|"repositories"|"lib"} */
function classifySymbol(name) {
  const subpath = symbolToSubpath.get(name);
  if (subpath) return subpath;
  if (name.startsWith("Drizzle") || name.startsWith("createDrizzle")) return "repositories";
  if (name.startsWith("I") && name.length > 1 && name[1] === name[1].toUpperCase())
    return "interfaces";
  console.warn(`Unknown symbol "${name}" — defaulting to interfaces`);
  return "interfaces";
}

/** @param {string} clause @returns {{ name: string, alias?: string, isType: boolean }[]} */
function parseImportClause(clause) {
  const inner = clause
    .trim()
    .replace(/^\{|\}$/g, "")
    .trim();
  if (!inner) return [];
  /** @type {{ name: string, alias?: string, isType: boolean }[]} */
  const specs = [];
  for (const part of inner.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const isType = /^type\s+/.test(trimmed);
    const rest = trimmed.replace(/^type\s+/, "");
    const [name, alias] = rest.split(/\s+as\s+/).map((s) => s.trim());
    specs.push({ name, alias: alias ?? undefined, isType });
  }
  return specs;
}

/** @param {{ name: string, alias?: string, isType: boolean }[]} specs @param {string} subpath @param {boolean} wholeTypeImport */
function formatImport(specs, subpath, wholeTypeImport) {
  const allType = wholeTypeImport || specs.every((s) => s.isType);
  const parts = specs.map(({ name, alias, isType }) => {
    const exported = alias ? `${name} as ${alias}` : name;
    if (allType) return exported;
    return isType ? `type ${exported}` : exported;
  });
  const keyword = allType ? "import type" : "import";
  return `${keyword} { ${parts.join(", ")} } from "@auction/persistence/${subpath}";`;
}

/** @param {string} clause @param {boolean} wholeTypeImport */
function rewriteClause(clause, wholeTypeImport) {
  const specs = parseImportClause(clause);
  /** @type {Map<string, typeof specs>} */
  const groups = new Map();
  for (const spec of specs) {
    const subpath = classifySymbol(spec.name);
    if (!groups.has(subpath)) groups.set(subpath, []);
    groups.get(subpath).push(spec);
  }
  const order = ["interfaces", "lib", "repositories"];
  return order
    .filter((s) => groups.has(s))
    .map((subpath) => formatImport(groups.get(subpath), subpath, wholeTypeImport));
}

function rewriteImportStatement(full, typeKeyword, clause) {
  const wholeTypeImport = Boolean(typeKeyword);
  if (/^\*\s+as\s+/.test(clause.trim())) {
    throw new Error(`Namespace import not supported: ${full}`);
  }
  const braceMatch = clause.match(/^\{([^}]*)\}$/);
  if (!braceMatch) return full;
  return rewriteClause(braceMatch[1], wholeTypeImport).join("\n");
}

function rewriteExportFrom(_full, typeKeyword, clause) {
  const wholeTypeExport = Boolean(typeKeyword);
  const specs = parseImportClause(clause);
  /** @type {Map<string, typeof specs>} */
  const groups = new Map();
  for (const spec of specs) {
    const subpath = classifySymbol(spec.name);
    if (!groups.has(subpath)) groups.set(subpath, []);
    groups.get(subpath).push(spec);
  }
  const order = ["interfaces", "lib", "repositories"];
  return order
    .filter((s) => groups.has(s))
    .map((subpath) => {
      const parts = groups.get(subpath).map(({ name, alias, isType }) => {
        const exported = alias ? `${name} as ${alias}` : name;
        if (wholeTypeExport || isType) return exported;
        return exported;
      });
      const keyword = wholeTypeExport ? "export type" : "export";
      return `${keyword} { ${parts.join(", ")} } from "@auction/persistence/${subpath}";`;
    })
    .join("\n");
}

/** @param {string} dir @returns {string[]} */
function listAppSources(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listAppSources(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** @param {string} text */
function migrateFileContent(text) {
  let next = text.replace(IMPORT_RE, (full, typeKeyword, _fromPart, clause) => {
    return rewriteImportStatement(full, typeKeyword, clause ?? _fromPart);
  });
  next = next.replace(EXPORT_FROM_RE, (full, typeKeyword, clause) => {
    return rewriteExportFrom(full, typeKeyword, clause);
  });
  next = next.replace(
    /import\s*\(\s*["']@auction\/persistence["']\s*\)/g,
    'import("@auction/persistence/interfaces")',
  );
  return next;
}

let filesChanged = 0;
for (const app of ["api", "worker", "auth", "web"]) {
  const appDir = join(root, "apps", app, "src");
  let files;
  try {
    files = listAppSources(appDir);
  } catch {
    continue;
  }
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(ROOT_SPECIFIER)) continue;
    const migrated = migrateFileContent(text);
    if (migrated !== text) {
      writeFileSync(file, migrated);
      filesChanged++;
    }
  }
}

// apps/api/scripts (outside src)
const apiScripts = join(root, "apps/api/scripts");
try {
  for (const file of listAppSources(apiScripts)) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(ROOT_SPECIFIER)) continue;
    const migrated = migrateFileContent(text);
    if (migrated !== text) {
      writeFileSync(file, migrated);
      filesChanged++;
    }
  }
} catch {
  // no scripts dir
}

console.log(`migrate-persistence-imports: updated ${filesChanged} files`);
