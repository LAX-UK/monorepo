import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { describe, expect, it } from "vitest";
import { lotDetailNotice, lotEditLink } from "./lot-detail-page.vm";

const readiness: CatalogReadinessResult = {
  items: [
    {
      id: "images",
      label: "Add at least one photo",
      ok: false,
      severity: "required",
      href: "/admin/lots/l1/images",
    },
    {
      id: "description",
      label: "Write a description",
      ok: true,
      severity: "required",
      href: "/admin/lots/l1/edit/catalog",
    },
  ],
  completeCount: 1,
  totalCount: 2,
  percent: 50,
  firstFailing: {
    id: "images",
    label: "Add at least one photo",
    ok: false,
    severity: "required",
    href: "/admin/lots/l1/images",
  },
};

const base = {
  lotId: "l1",
  status: "draft" as const,
  connectRequired: false,
  sellerLegalEntityId: "le_1",
  inDraftSale: false,
  readiness,
  canManageCatalog: true,
};

describe("lot detail notice", () => {
  it("puts a waiting withdrawal request first, whatever the status", () => {
    const notice = lotDetailNotice({
      ...base,
      status: "active",
      withdrawalRequestedAt: "2026-10-20T09:00:00.000Z",
    });
    expect(notice?.id).toBe("withdrawal");
    expect(notice?.body).toContain("20 Oct 2026");
  });

  it("says the seller cannot be paid before anything else on a draft, linking to the seller", () => {
    const notice = lotDetailNotice({ ...base, connectRequired: true });
    expect(notice).toMatchObject({ id: "connect", tone: "danger" });
    expect(notice?.action?.href).toBe("/admin/legal-entities/le_1");
  });

  it("explains a lot in a draft sale is published with the sale", () => {
    expect(lotDetailNotice({ ...base, inDraftSale: true })?.id).toBe("draft-sale");
  });

  it("names the next required check and links to it for staff who can edit", () => {
    const notice = lotDetailNotice(base);
    expect(notice?.title).toBe("1 of 2 publish checks complete");
    expect(notice?.body).toContain("Add at least one photo");
    expect(notice?.action?.href).toBe("/admin/lots/l1/images");
    expect(lotDetailNotice({ ...base, canManageCatalog: false })?.action).toBeNull();
  });

  it("shows nothing for a published lot with no request", () => {
    expect(lotDetailNotice({ ...base, status: "scheduled" })).toBeNull();
  });

  it("offers the edit a lot's state allows", () => {
    expect(lotEditLink("l1", "draft")?.label).toBe("Edit draft");
    expect(lotEditLink("l1", "active")?.href).toBe("/admin/lots/l1/edit/catalog");
    expect(lotEditLink("l1", "ended")).toBeNull();
  });
});
