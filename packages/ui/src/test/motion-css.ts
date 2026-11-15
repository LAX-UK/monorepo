import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The kit's overlay motion stylesheet, as written (packages/ui/src/lax/motion.css). */
export const MOTION_CSS = readFileSync(resolve(process.cwd(), "src/lax/motion.css"), "utf8");

/** Source with comments removed, so a rule named only in a comment does not count. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Everything `docs/design/motion.md` (MO13) asks of reduced motion, as a list of what is missing
 * (empty when the stylesheet is right). A test runs it on the real file, and again on a copy with
 * the rule removed, so the check itself is proven to fail without the rule.
 */
export function reducedMotionProblems(css: string): string[] {
  const source = stripComments(css);
  const problems: string[] = [];
  const reduced = source.includes("@media (prefers-reduced-motion: reduce)");
  if (!reduced) problems.push("no @media (prefers-reduced-motion: reduce) block");
  if (!source.includes('[data-reduce-motion="force-reduce"]'))
    problems.push("Bid's in-app motion switch is not handled");
  // Public layers keep a fade only: the movement keyframes must not be reachable under reduce.
  const publicReduce =
    /@media \(prefers-reduced-motion: reduce\) \{\s*:root \[data-lax-motion\] \{([^}]*)\}/.exec(
      source,
    );
  if (!publicReduce) problems.push("public reduced-motion rule missing");
  else if (!/--lax-anim-in: lax-fade-in/.test(publicReduce[1] ?? ""))
    problems.push("public reduced motion is not a fade");
  if (
    !/:root \[data-lax-density="staff"\]\[data-lax-motion\][^{]*\{[^}]*--lax-anim-in: none/.test(
      source,
    )
  )
    problems.push("staff layers are not instant under reduced motion");
  if (
    !/\[data-lax-product="account"\] \[data-lax-motion\][^{]*\{[^}]*--lax-anim-in: none/.test(
      source,
    )
  )
    problems.push("LAX Account is not instant under reduced motion");
  return problems;
}

/** The `@media (prefers-reduced-motion: reduce)` blocks removed, as the mutation under test. */
export function withoutReducedMotionRule(css: string): string {
  return css.replace(/@media \(prefers-reduced-motion: reduce\) \{(?:[^{}]*\{[^{}]*\})*\s*\}/g, "");
}
