import { describe, expect, it } from "vitest";
import { buildLotDetailNavActions } from "./build-lot-mobile-actions";

describe("buildLotDetailNavActions", () => {
  it("prefers edit draft for draft lots", () => {
    const nav = buildLotDetailNavActions({
      lotId: "lot-1",
      publicHref: "/lot/1",
      canEditDraft: true,
      canEditLot: false,
      showEditCatalog: false,
    });
    expect(nav.barActions[0]).toMatchObject({ id: "edit-draft", label: "Edit draft" });
    expect(nav.primaryMetaAction).toEqual({
      label: "Edit draft →",
      href: "/admin/lots/lot-1/edit",
    });
    expect(nav.quickRailItems.some((i) => i.id === "duplicate")).toBe(false);
  });

  it("uses catalog edit when lot is active", () => {
    const nav = buildLotDetailNavActions({
      lotId: "lot-2",
      publicHref: "/lot/2",
      canEditDraft: false,
      canEditLot: false,
      showEditCatalog: true,
    });
    expect(nav.barActions[0]).toMatchObject({ id: "edit-catalog" });
  });
});
