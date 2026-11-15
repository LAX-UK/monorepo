import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The kit's overlay motion stylesheet, as written (packages/ui/src/lax/motion.css). */
export const MOTION_CSS = readFileSync(resolve(process.cwd(), "src/lax/motion.css"), "utf8");

/** Source with comments removed, so a rule named only in a comment does not count. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}
