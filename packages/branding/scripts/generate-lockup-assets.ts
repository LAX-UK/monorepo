/**
 * Writes the static lockup SVGs in public/lockups from the lockup definition, so the files and
 * the React component can never disagree. Run from the repo root after changing the lockup
 * geometry, a product accent or a descriptor. It also refreshes the copies
 * that apps serve from their own files (lockup-copies.ts):
 *
 *   pnpm --filter @auction/branding generate:lockups
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCKUP_COPIES } from "../src/lockup/lockup-copies.js";
import {
  LAX_LOCKUP_KINDS,
  laxLockupAutoSvg,
  laxLockupFileName,
  laxLockupSvg,
} from "../src/lockup/lockup.js";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(packageDir, "public/lockups");
mkdirSync(outDir, { recursive: true });

for (const kind of LAX_LOCKUP_KINDS) {
  for (const scheme of ["light", "dark"] as const) {
    writeFileSync(join(outDir, laxLockupFileName(kind, scheme)), laxLockupSvg(kind, scheme));
  }
  writeFileSync(join(outDir, laxLockupFileName(kind, "auto")), laxLockupAutoSvg(kind));
}

for (const { path, kind, variant } of LOCKUP_COPIES) {
  copyFileSync(join(outDir, laxLockupFileName(kind, variant)), join(packageDir, "../..", path));
}
