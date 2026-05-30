import { describe, expect, it } from "vitest";
import { buildSaleDetailNavActions } from "./build-sale-lifecycle-mobile-actions";

describe("buildSaleDetailNavActions", () => {
  it("shows saleroom first when liveish", () => {
    const nav = buildSaleDetailNavActions({
      saleId: "sale-1",
      publicHref: "/sale/1",
      canEdit: true,
      liveish: true,
      isDraft: false,
      canManageSales: true,
    });
    expect(nav.barActions[0]).toMatchObject({ id: "saleroom" });
    expect(nav.primaryMetaAction).toEqual({
      label: "Open saleroom →",
      href: "/admin/saleroom/sale-1",
    });
  });

  it("shows setup and edit in rail for draft sales", () => {
    const nav = buildSaleDetailNavActions({
      saleId: "sale-2",
      publicHref: "/sale/2",
      canEdit: true,
      liveish: false,
      isDraft: true,
      canManageSales: true,
      draftSetupHref: "/admin/sales/sale-2/setup?step=review",
    });
    expect(nav.quickRailItems.map((i) => i.id)).toEqual(["setup", "edit", "public"]);
    expect(nav.primaryMetaAction).toEqual({
      label: "Edit draft →",
      href: "/admin/sales/sale-2/edit",
    });
  });
});
