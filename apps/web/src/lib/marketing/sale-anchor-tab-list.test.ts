import { buildSaleAnchorTabs } from "@/lib/marketing/sale-anchor-tab-list";
import { describe, expect, it } from "vitest";

describe("buildSaleAnchorTabs", () => {
  it("includes catalog and overview by default", () => {
    const tabs = buildSaleAnchorTabs({ showTelephone: false });
    const ids = tabs.map((t) => t.id);
    expect(ids).toContain("catalog");
    expect(ids).toContain("overview");
  });

  it("excludes gallery tab by default", () => {
    const tabs = buildSaleAnchorTabs({ showTelephone: false });
    expect(tabs.map((t) => t.id)).not.toContain("gallery");
  });

  it("includes gallery tab when showGallery is true", () => {
    const tabs = buildSaleAnchorTabs({ showTelephone: false, showGallery: true });
    const ids = tabs.map((t) => t.id);
    expect(ids).toContain("gallery");
  });

  it("gallery tab appears before overview", () => {
    const tabs = buildSaleAnchorTabs({ showTelephone: false, showGallery: true });
    const galleryIdx = tabs.findIndex((t) => t.id === "gallery");
    const overviewIdx = tabs.findIndex((t) => t.id === "overview");
    expect(galleryIdx).toBeLessThan(overviewIdx);
  });

  it("includes telephone tab when showTelephone is true", () => {
    const tabs = buildSaleAnchorTabs({ showTelephone: true });
    expect(tabs.map((t) => t.id)).toContain("telephone");
  });
});
