import { describe, expect, it } from "vitest";
import { buildSaleBoardMobileMenuItems } from "./build-sale-board-mobile-menu";

describe("buildSaleBoardMobileMenuItems", () => {
  it("shows edit and setup for auction managers on draft sales", () => {
    const ids = buildSaleBoardMobileMenuItems(
      { saleId: "s1", title: "Draft sale", status: "draft" },
      { canManageSales: true },
    ).map((i) => i.id);
    expect(ids).toEqual(["open", "edit", "setup", "site", "copy-id"]);
  });

  it("shows setup but not edit for catalogue-only staff on drafts", () => {
    const ids = buildSaleBoardMobileMenuItems(
      { saleId: "s1", title: "Draft sale", status: "draft" },
      { canManageSales: false },
    ).map((i) => i.id);
    expect(ids).toEqual(["open", "setup", "site", "copy-id"]);
  });

  it("omits edit for live sales without manage permission", () => {
    const ids = buildSaleBoardMobileMenuItems(
      { saleId: "s1", title: "Live sale", status: "active" },
      { canManageSales: false },
    ).map((i) => i.id);
    expect(ids).toEqual(["open", "site", "copy-id"]);
  });
});
