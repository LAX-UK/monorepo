import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { describe, expect, it } from "vitest";
import { firstBlockedSeller, saleDetailNotice, saleEditLink } from "./sale-detail-page.vm";

const readiness: CatalogReadinessResult = {
  items: [{ id: "lots", label: "Add at least one lot", ok: false, severity: "required" }],
  completeCount: 3,
  totalCount: 4,
  percent: 75,
  firstFailing: { id: "lots", label: "Add at least one lot", ok: false, severity: "required" },
};

const base = {
  status: "draft" as const,
  connectRequired: false,
  blockedSellerLegalEntityId: null,
  sellingOnAtg: false,
  readiness,
  setupHref: "/admin/sales/s1/setup?step=lots",
};

describe("sale detail notice", () => {
  it("puts a seller who cannot be paid first on a draft", () => {
    const notice = saleDetailNotice({
      ...base,
      connectRequired: true,
      blockedSellerLegalEntityId: "le_9",
    });
    expect(notice).toMatchObject({ id: "connect", tone: "danger" });
    expect(notice?.action?.href).toBe("/admin/legal-entities/le_9");
  });

  it("says an ATG sale is managed on ATG", () => {
    expect(saleDetailNotice({ ...base, sellingOnAtg: true })?.id).toBe("atg");
    expect(saleDetailNotice({ ...base, status: "ended", sellingOnAtg: true })).toBeNull();
  });

  it("counts the setup checks and links to the next one", () => {
    const notice = saleDetailNotice(base);
    expect(notice?.title).toBe("3 of 4 setup checks complete");
    expect(notice?.action).toEqual({ label: "Continue setup", href: base.setupHref });
  });

  it("shows nothing for a published sale", () => {
    expect(saleDetailNotice({ ...base, status: "scheduled" })).toBeNull();
  });

  it("finds the first lot whose seller cannot be paid", () => {
    expect(
      firstBlockedSeller(
        [
          { id: "a", sellerLegalEntityId: "le_1" },
          { id: "b", sellerLegalEntityId: "le_2" },
        ],
        { b: true },
      ),
    ).toEqual({ blocked: true, sellerLegalEntityId: "le_2" });
    expect(firstBlockedSeller([{ id: "a" }], undefined).blocked).toBe(false);
  });
});

describe("sale header edit link", () => {
  const link = {
    status: "draft" as const,
    canManage: true,
    liveish: false,
    editHref: "/admin/sales/s1/edit",
    setupHref: base.setupHref,
    setupOpen: true,
  };

  it("does not repeat Continue setup when the notice offers it", () => {
    expect(saleEditLink({ ...link, notice: saleDetailNotice(base) })).toEqual({
      label: "Edit draft",
      href: "/admin/sales/s1/edit",
    });
  });

  it("keeps Continue setup in the header when another notice is in front", () => {
    const notice = saleDetailNotice({ ...base, sellingOnAtg: true });
    expect(saleEditLink({ ...link, notice })?.label).toBe("Continue setup");
  });

  it("edits a live sale, and offers nothing to people who cannot manage sales", () => {
    expect(
      saleEditLink({ ...link, status: "active", liveish: true, setupOpen: false, notice: null })
        ?.label,
    ).toBe("Edit details");
    expect(saleEditLink({ ...link, canManage: false, notice: null })).toBeNull();
  });
});
