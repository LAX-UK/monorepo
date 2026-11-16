import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = (p: string) => new URL(p, import.meta.url);
const motionCss = readFileSync(here("./tokens-motion.css"), "utf8");
const coverTab = readFileSync(here("../components/admin/sale-cover/sale-cover-tab.tsx"), "utf8");

/** Staff tools move less (docs/design/motion.md, MO11): no row stagger, tab fade on the tokens. */
describe("Bid admin motion", () => {
  it("has no table row stagger or literal tab fade", () => {
    expect(motionCss).not.toMatch(/admin-data-table-stagger|admin-row-enter|admin-tab-/);
  });

  it("fades the sale cover slot panel through the kit's marker, remounted on each switch", () => {
    const panel = coverTab.match(/<div\s+key=\{selected\}\s+role="tabpanel"[^>]*>/)?.[0] ?? "";
    expect(panel).toContain('data-lax-motion="tabpanel"');
    expect(panel).toContain('data-state="active"');
  });
});
