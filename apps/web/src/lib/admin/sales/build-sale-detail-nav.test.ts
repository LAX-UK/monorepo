import {
  type SaleDetailNavGroup,
  buildSaleDetailNav,
  resolveSaleDetailNav,
} from "@/lib/admin/sales/build-sale-detail-nav";
import { SALE_DETAIL_TABS, parseSaleDetailTabFromPath } from "@/lib/admin/sales/sale-detail-routes";
import { SALE_DETAIL_GROUPS } from "@/lib/admin/sales/sale-detail-sections";
import { describe, expect, it } from "vitest";

const base = {
  saleId: "sale-1",
  liveish: true,
  lotCount: 5,
  registrationCount: 3,
  pendingRegistrationCount: 0,
  pendingTelephoneBookingCount: 0,
  documentCount: 2,
  overviewAttentionCount: 0,
};

const shape = (groups: SaleDetailNavGroup[]) =>
  Object.fromEntries(groups.map((group) => [group.id, group.pages.map((page) => page.id)]));

describe("sale detail groups", () => {
  it("places every sale page in exactly one group", () => {
    const placed = SALE_DETAIL_GROUPS.flatMap((group) => group.sections);
    expect([...placed].sort()).toEqual([...SALE_DETAIL_TABS].sort());
  });
});

describe("buildSaleDetailNav", () => {
  it("groups a saleroom sale's pages by job for sales managers", () => {
    for (const deliveryMode of ["onsite", "hybrid"] as const) {
      const groups = buildSaleDetailNav({ ...base, deliveryMode, canManageSales: true });
      expect(shape(groups)).toEqual({
        overview: ["overview"],
        lots: ["lots"],
        bidders: ["registrations", "telephone-bookings"],
        "sale-day": ["operations"],
        content: ["cover", "media", "press", "documents"],
        settings: ["schedule", "atg"],
      });
      expect(groups.map((group) => group.label)).toEqual([
        "Overview",
        "Lots",
        "Bidders",
        "Sale day",
        "Content",
        "Settings",
      ]);
    }
  });

  it("leaves the saleroom pages, and the sale day group, out of an online sale", () => {
    const groups = buildSaleDetailNav({ ...base, deliveryMode: "online", canManageSales: true });
    expect(shape(groups)).toEqual({
      overview: ["overview"],
      lots: ["lots"],
      bidders: ["registrations"],
      content: ["cover", "press", "documents"],
      settings: ["schedule", "atg"],
    });
  });

  it("offers catalogue-only staff just the pages whose API routes they can call", () => {
    const groups = buildSaleDetailNav({ ...base, deliveryMode: "hybrid", canManageSales: false });
    expect(shape(groups)).toEqual({
      overview: ["overview"],
      lots: ["lots"],
      content: ["cover", "media", "press", "documents"],
      settings: ["schedule"],
    });
  });

  it("opens a group on its first page, and keeps every page at its own URL", () => {
    const groups = buildSaleDetailNav({ ...base, deliveryMode: "hybrid", canManageSales: true });
    const byId = Object.fromEntries(groups.map((group) => [group.id, group]));
    expect(byId.overview?.href).toBe("/admin/sales/sale-1");
    expect(byId.bidders?.href).toBe("/admin/sales/sale-1/registrations");
    expect(byId.content?.href).toBe("/admin/sales/sale-1/cover");
    expect(byId.settings?.pages.map((page) => page.href)).toEqual([
      "/admin/sales/sale-1/schedule",
      "/admin/sales/sale-1/atg",
    ]);
    expect(byId.bidders?.pages.find((page) => page.id === "telephone-bookings")?.label).toBe(
      "Telephone bookings",
    );
  });

  it("keeps single-page counts on the group and rolls up only waiting work", () => {
    const quiet = buildSaleDetailNav({
      ...base,
      deliveryMode: "hybrid",
      canManageSales: true,
      overviewAttentionCount: 4,
    });
    const quietById = Object.fromEntries(quiet.map((group) => [group.id, group]));
    expect(quietById.overview).toMatchObject({ count: 4 });
    expect(quietById.lots).toMatchObject({ count: 5 });
    expect(quietById.bidders?.count).toBeUndefined();
    expect(quietById.content?.count).toBeUndefined();
    expect(quietById.content?.pages.find((page) => page.id === "documents")?.count).toBe(2);
    expect(quietById.bidders?.pages.find((page) => page.id === "registrations")?.count).toBe(3);

    const busy = buildSaleDetailNav({
      ...base,
      deliveryMode: "hybrid",
      canManageSales: true,
      pendingRegistrationCount: 2,
      pendingTelephoneBookingCount: 1,
    });
    const bidders = busy.find((group) => group.id === "bidders");
    expect(bidders).toMatchObject({ count: 3, countTone: "attention", countLabel: "waiting" });
    expect(bidders?.pages.map((page) => [page.id, page.count, page.countTone])).toEqual([
      ["registrations", 2, "attention"],
      ["telephone-bookings", 1, "attention"],
    ]);
  });

  it("counts registrations and pending reviews only once the sale is live", () => {
    const groups = buildSaleDetailNav({
      ...base,
      deliveryMode: "online",
      canManageSales: true,
      liveish: false,
      pendingRegistrationCount: 2,
    });
    const bidders = groups.find((group) => group.id === "bidders");
    expect(bidders?.count).toBeUndefined();
    expect(bidders?.pages[0]?.count).toBeUndefined();
  });
});

describe("resolveSaleDetailNav", () => {
  const groups = buildSaleDetailNav({ ...base, deliveryMode: "hybrid", canManageSales: true });
  const at = (path: string) =>
    resolveSaleDetailNav(groups, parseSaleDetailTabFromPath(path, "sale-1"));

  it("lands every existing page URL in its group, with that page current", () => {
    const expected: Record<string, [string, string]> = {
      "/admin/sales/sale-1": ["overview", "overview"],
      "/admin/sales/sale-1/lots": ["lots", "lots"],
      "/admin/sales/sale-1/registrations": ["bidders", "registrations"],
      "/admin/sales/sale-1/telephone-bookings": ["bidders", "telephone-bookings"],
      "/admin/sales/sale-1/operations": ["sale-day", "operations"],
      "/admin/sales/sale-1/cover": ["content", "cover"],
      "/admin/sales/sale-1/media": ["content", "media"],
      "/admin/sales/sale-1/press": ["content", "press"],
      "/admin/sales/sale-1/documents": ["content", "documents"],
      "/admin/sales/sale-1/schedule": ["settings", "schedule"],
      "/admin/sales/sale-1/atg": ["settings", "atg"],
    };
    for (const [path, [groupId, pageId]] of Object.entries(expected)) {
      const state = at(path);
      expect(state.group?.id, path).toBe(groupId);
      expect(state.pageId, path).toBe(pageId);
    }
  });

  it("shows secondary tabs only for a group with more than one page", () => {
    expect(at("/admin/sales/sale-1/press").pages.map((page) => page.id)).toEqual([
      "cover",
      "media",
      "press",
      "documents",
    ]);
    expect(at("/admin/sales/sale-1/operations").pages).toEqual([]);
    expect(at("/admin/sales/sale-1/lots").pages).toEqual([]);
  });
});
