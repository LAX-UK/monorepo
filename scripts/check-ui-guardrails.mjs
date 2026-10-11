#!/usr/bin/env node
/**
 * UI guardrails for apps/web and apps/art — multiline-aware checks.
 * Native form controls are also enforced by apps/web/scripts/check-native-form-controls.mjs (web lint).
 * apps/art follows the Apple model: primitives come from @auction/ui, @auction/marketing-ui, and
 * @auction/branding; the app owns layout, composition, and copy only (docs/DESIGN_SYSTEM.md).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB_SRC = path.join(ROOT, "apps/web/src");
const ART_SRC = path.join(ROOT, "apps/art/src");
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

/** Rules shared by every app surface. */
function checkSharedPrimitives(rel, text, violations) {
  if (/<button(?:\s|\/>|>)/.test(text)) {
    violations.push(`${rel}: raw <button> — use Button from '@auction/ui/components/button'`);
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

function checkWebFile(rel, base, text, violations) {
  checkSharedPrimitives(rel, text, violations);

  if (/MaterialIcon|from ["'][^"']*material-icon/.test(text)) {
    violations.push(`${rel}: MaterialIcon removed — use lucide-react`);
  }

  if (/type="file"/.test(text) && !ALLOWED_FILE_INPUT.has(base)) {
    violations.push(`${rel}: type="file" outside approved upload modules`);
  }

  if (rel.startsWith("components/admin/catalog/")) {
    if (/MarketingFilterSheet/.test(text)) {
      violations.push(
        `${rel}: MarketingFilterSheet in admin catalog — use SplitFilterSheet from '@/components/ui/split-filter-sheet'`,
      );
    }
  }

  if (rel.startsWith("app/(marketing)/") && /\bSectionCta\b/.test(text)) {
    violations.push(
      `${rel}: SectionCta in marketing route — use MarketingBidPromoCta or MarketingPromoCta`,
    );
  }

  if (rel.includes("marketing") || rel.includes("sections/home")) {
    if (/>\s*View All\s*</.test(text)) {
      violations.push(`${rel}: use "View all" label via MarketingViewAllLink`);
    }
  }
}

function checkArtFile(rel, _base, text, violations) {
  checkSharedPrimitives(rel, text, violations);

  if (/<input(?:\s|\/>|>)/.test(text)) {
    violations.push(`${rel}: raw <input> — use Input from '@auction/ui/components/input'`);
  }

  if (/type="file"/.test(text)) {
    violations.push(`${rel}: type="file" — lax.art has no upload surfaces`);
  }

  if (/from ["']lucide-react["']/.test(text)) {
    violations.push(
      `${rel}: direct lucide-react import — use Marketing*Icon from '@auction/marketing-ui'`,
    );
  }

  if (/from ["']vaul["']/.test(text)) {
    violations.push(
      `${rel}: direct vaul import — use MarketingSideSheet or BottomSheet from shared packages`,
    );
  }

  if (/>\s*View All\s*</.test(text)) {
    violations.push(`${rel}: use "View all" label via MarketingViewAllLink`);
  }
}

const SURFACES = [
  { label: "apps/web/src", src: WEB_SRC, check: checkWebFile },
  { label: "apps/art/src", src: ART_SRC, check: checkArtFile },
];

let failed = false;

for (const surface of SURFACES) {
  const files = (await walk(surface.src)).filter((f) => !isSkipped(f));
  const violations = [];
  for (const file of files) {
    const rel = path.relative(surface.src, file);
    const text = await readFile(file, "utf8");
    surface.check(rel, path.basename(file), text, violations);
  }
  if (violations.length > 0) {
    failed = true;
    console.error(`error: UI guardrail violations in ${surface.label}:\n`);
    for (const v of violations) console.error(`  ${v}`);
    console.error("");
  }
}

if (failed) process.exit(1);

console.log("ui guardrails: ok");
