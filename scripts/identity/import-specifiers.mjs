import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SOURCE_EXTENSION_RE = /\.(?:c|m)?(?:j|t)sx?$/;
const SKIP_DIRECTORIES = new Set([".git", ".turbo", "coverage", "dist", "node_modules"]);

const STATIC_SPECIFIER_RE =
  /(?:import|export)\s+(?:type\s+)?[\w*\s{},]+\s+from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)/g;
const IMPORT_EXPRESSION_RE = /\bimport\s*\(\s*([^),]+)(?:,[^)]*)?\)/g;
const STRING_LITERAL_RE = /^(["'])([^"']+)\1$/s;

export function listSourceFiles(directory, { includeTests = true } = {}) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path, { includeTests }));
    } else if (
      SOURCE_EXTENSION_RE.test(entry.name) &&
      (includeTests || !/\.(?:test|spec|integration\.test)\.[cm]?[jt]sx?$/.test(entry.name))
    ) {
      files.push(path);
    }
  }
  return files;
}

export function readImportSpecifiers(file) {
  return importSpecifiers(readFileSync(file, "utf8"));
}

export function importSpecifiers(source) {
  const specifiers = [];

  for (const match of source.matchAll(STATIC_SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) specifiers.push({ specifier, dynamic: false });
  }

  for (const match of source.matchAll(IMPORT_EXPRESSION_RE)) {
    const expression = match[1]?.trim() ?? "";
    const literal = expression.match(STRING_LITERAL_RE);
    specifiers.push(
      literal
        ? { specifier: literal[2], dynamic: true }
        : { expression, dynamic: true, unresolved: true },
    );
  }

  return specifiers;
}
