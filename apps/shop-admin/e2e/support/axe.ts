import AxeBuilder from "@axe-core/playwright";
import { type Page, expect } from "@playwright/test";

/**
 * Violations that exist today and are out of scope for the change that added the gate. Each
 * entry names the rule and the page, says why it stays, and is removed when it is fixed.
 * Empty on purpose: add an entry only with a reason and a follow-up.
 */
export const AXE_ALLOWLIST: ReadonlyArray<{ rule: string; path: string; reason: string }> = [];

const BLOCKING_IMPACTS = ["critical", "serious"];

/** Fails on serious or critical WCAG 2 A/AA violations anywhere on the page, shell included. */
export async function expectNoSeriousAxeViolations(page: Page, path: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = result.violations.filter(
    (violation) =>
      BLOCKING_IMPACTS.includes(violation.impact ?? "") &&
      !AXE_ALLOWLIST.some((allowed) => allowed.rule === violation.id && allowed.path === path),
  );
  const details = blocking
    .map((violation) => {
      const targets = violation.nodes
        .slice(0, 3)
        .map((node) => `      ${node.target.join(" ")}`)
        .join("\n");
      return `  - ${violation.id} (${violation.impact}): ${violation.help}\n${targets}`;
    })
    .join("\n");
  expect(
    blocking,
    blocking.length > 0 ? `Axe violations on ${path}:\n${details}` : undefined,
  ).toHaveLength(0);
}
