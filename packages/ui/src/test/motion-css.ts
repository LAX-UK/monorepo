import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The kit's overlay motion stylesheet, as written (packages/ui/src/lax/motion.css). */
export const MOTION_CSS = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../lax/motion.css"),
  "utf8",
);

/** Source with comments removed, so a rule named only in a comment does not count. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}
