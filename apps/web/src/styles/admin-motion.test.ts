import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = (p: string) => new URL(p, import.meta.url);
const motionCss = readFileSync(here("./tokens-motion.css"), "utf8");
const tabs = readFileSync(here("../components/dashboard/primitives/admin-detail-tabs.tsx"), "utf8");

/** Staff tools move less (docs/design/motion.md, MO11): no row stagger, tab fade on the tokens. */
describe("Bid admin motion", () => {
  it("has no table row stagger or literal tab fade", () => {
    expect(motionCss).not.toMatch(/admin-data-table-stagger|admin-row-enter|admin-tab-/);
  });

  it("fades tab content through the kit's motion marker, not a local class", () => {
    expect(tabs).toContain('data-lax-motion="tabpanel"');
    expect(tabs).not.toContain("admin-tab-crossfade");
  });
});
