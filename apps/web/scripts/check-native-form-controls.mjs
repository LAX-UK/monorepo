#!/usr/bin/env node
/**
 * Fail CI when visible native form controls appear in apps/web/src.
 * Hidden file inputs are allowed only in approved upload field modules.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../src");
const SKIP_SUFFIX = [".test.ts", ".test.tsx"];
const ALLOWED_FILE_INPUT = new Set([
  "document-upload-field.tsx",
  "image-upload-field.tsx",
  "image-gallery-manager.tsx",
  "org-documents-step-client.tsx",
]);

const PATTERNS = [
  { re: /<select[\s>/]/, label: "<select>" },
  { re: /<textarea[\s>/]/, label: "<textarea>" },
  { re: /<progress[\s>/]/, label: "<progress>" },
  { re: /<details[\s>/]/, label: "<details>" },
  {
    re: /type="(datetime-local|date|time|range|checkbox|radio)"/,
    label: "native input type",
  },
];

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
const violations = [];

for (const file of files) {
  if (SKIP_SUFFIX.some((s) => file.endsWith(s))) continue;
  const rel = path.relative(ROOT, file);
  const base = path.basename(file);
  const text = await readFile(file, "utf8");

  for (const { re, label } of PATTERNS) {
    if (re.test(text)) violations.push(`${rel}: ${label}`);
  }

  if (/type="file"/.test(text) && !ALLOWED_FILE_INPUT.has(base)) {
    violations.push(`${rel}: type="file" outside approved upload modules`);
  }
}

if (violations.length > 0) {
  console.error("error: native form controls found in apps/web/src:\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("native form controls: ok");
