/**
 * Writes the static lockup SVGs in public/lockups from the lockup definition, so the files and
 * the React component can never disagree. Run from the repo root after changing the lockup
 * geometry, a product accent or a descriptor:
 *
 *   pnpm --filter @auction/branding generate:lockups
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LAX_LOCKUP_KINDS,
  laxLockupAutoSvg,
  laxLockupFileName,
  laxLockupSvg,
} from "../src/lockup/lockup.js";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/lockups");
mkdirSync(outDir, { recursive: true });

for (const kind of LAX_LOCKUP_KINDS) {
  for (const scheme of ["light", "dark"] as const) {
    writeFileSync(join(outDir, laxLockupFileName(kind, scheme)), laxLockupSvg(kind, scheme));
  }
  writeFileSync(join(outDir, laxLockupFileName(kind, "auto")), laxLockupAutoSvg(kind));
}
