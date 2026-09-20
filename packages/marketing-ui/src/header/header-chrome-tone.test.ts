import { describe, expect, it } from "vitest";
import {
  headerChromeIconClass,
  headerMegaNavChevronClass,
  headerMegaNavTriggerClass,
  headerUtilityLinkClass,
} from "./header-chrome-tone.js";

describe("marketing header chrome", () => {
  it("uses on-dark mega trigger tones", () => {
    const idle = headerMegaNavTriggerClass("on-dark", { active: false, open: false });
    const current = headerMegaNavTriggerClass("on-dark", { active: true, open: false });
    expect(idle).toContain("text-hero-foreground/85");
    expect(idle).toContain("hover:border-hero-foreground/45");
    expect(current).toContain("border-hero-foreground");
    expect(current).toContain("text-hero-foreground");
  });

  it("uses on-light mega trigger tones", () => {
    const idle = headerMegaNavTriggerClass("on-light", { active: false, open: false });
    const open = headerMegaNavTriggerClass("on-light", { active: false, open: true });
    expect(idle).toContain("text-nav-text");
    expect(open).toContain("border-brand-900");
    expect(headerMegaNavChevronClass("on-light", true)).toContain("rotate-180");
  });

  it("keeps icon and utility chrome on shared tones", () => {
    expect(headerChromeIconClass("on-dark")).toContain("text-hero-foreground");
    expect(headerChromeIconClass("on-light")).toContain("hover:bg-page-bg");
    expect(headerUtilityLinkClass("on-dark", false)).toContain("text-hero-foreground/80");
    expect(headerUtilityLinkClass("on-light", true)).toContain("text-brand-900");
  });
});
