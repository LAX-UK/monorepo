/**
 * Writes the static lockup SVGs in public/lockups from the lockup definition, so the files and
 * the React component can never disagree. Run from the repo root after changing the lockup
 * geometry, a product accent or a descriptor. It also refreshes the copies of the London Art
 * Exchange lockup that apps and hosted sign-in serve themselves:
 *
 *   pnpm --filter @auction/branding generate:lockups
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAX_LOCKUP_KINDS,
  laxLockupAutoSvg,
  laxLockupFileName,
  laxLockupSvg,
} from "../src/lockup/lockup.js";
import { WORDMARK_COPIES } from "../src/lockup/wordmark-copies.js";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(packageDir, "public/lockups");
mkdirSync(outDir, { recursive: true });

for (const kind of LAX_LOCKUP_KINDS) {
  for (const scheme of ["light", "dark"] as const) {
    writeFileSync(join(outDir, laxLockupFileName(kind, scheme)), laxLockupSvg(kind, scheme));
  }
  writeFileSync(join(outDir, laxLockupFileName(kind, "auto")), laxLockupAutoSvg(kind));
}

for (const { path, variant } of WORDMARK_COPIES) {
  copyFileSync(
    join(outDir, laxLockupFileName("exchange", variant)),
    join(packageDir, "../..", path),
  );
}
