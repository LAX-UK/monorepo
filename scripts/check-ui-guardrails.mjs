#!/usr/bin/env node
/**
 * UI guardrails for apps/web — multiline-aware checks.
 * Native form controls are also enforced by apps/web/scripts/check-native-form-controls.mjs (web lint).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");
const SKIP_SUFFIX = [".test.ts", ".test.tsx"];
const ALLOWED_FILE_INPUT = new Set([
  "document-upload-field.tsx",
  "image-upload-field.tsx",
  "image-gallery-manager.tsx",
  "org-documents-step-client.tsx",
]);

async function walk(dir, out = []) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(full, out);
    else if (ent.name.endsWith(".ts") || ent.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function isSkipped(file) {
  return SKIP_SUFFIX.some((s) => file.endsWith(s));
}

const files = (await walk(WEB_SRC)).filter((f) => !isSkipped(f));
const violations = [];

for (const file of files) {
  const rel = path.relative(WEB_SRC, file);
  const base = path.basename(file);
  const text = await readFile(file, "utf8");

  if (/<button(?:\s|\/>|>)/.test(text)) {
    violations.push(`${rel}: raw <button> — use Button from '@auction/ui/components/button'`);
  }

  if (/MaterialIcon|from ["'][^"']*material-icon/.test(text)) {
    violations.push(`${rel}: MaterialIcon removed — use lucide-react`);
  }

  if (/from ["']@radix-ui\//.test(text)) {
    violations.push(`${rel}: direct @radix-ui/* import — use '@auction/ui/components/*'`);
  }

  if (/<(?:select|textarea|progress|details)(?:\s|\/>|>)/.test(text)) {
    violations.push(`${rel}: native HTML control — use @auction/ui components`);
  }

  if (/type="(?:datetime-local|date|time|range|checkbox|radio)"/.test(text)) {
    violations.push(`${rel}: native input type — use @auction/ui pickers/controls`);
  }

  if (/type="file"/.test(text) && !ALLOWED_FILE_INPUT.has(base)) {
    violations.push(`${rel}: type="file" outside approved upload modules`);
  }

  if (/window\.(?:confirm|alert|prompt)\(/.test(text)) {
    violations.push(
      `${rel}: native window dialog — use ConfirmDialog from '@auction/ui/components/confirm-dialog'`,
    );
  }

  if (/(?:^|[^.\w])(?:confirm|alert|prompt)\(/.test(text)) {
    violations.push(
      `${rel}: native dialog — use ConfirmDialog from '@auction/ui/components/confirm-dialog'`,
    );
  }
}

if (violations.length > 0) {
  console.error("error: UI guardrail violations in apps/web/src:\n");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("ui guardrails: ok");
