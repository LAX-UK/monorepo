import { describe, expect, it } from "vitest";
import { buildSaleBoardMobileMenuItems } from "./build-sale-board-mobile-menu";

describe("buildSaleBoardMobileMenuItems", () => {
  const deletableDraft = {
    saleId: "s1",
    title: "Draft sale",
    status: "draft" as const,
    canDelete: true,
  };

  it("shows edit and setup for auction managers on draft sales", () => {
    const ids = buildSaleBoardMobileMenuItems(deletableDraft, { canManageSales: true }).map(
      (i) => i.id,
    );
    expect(ids).toEqual(["open", "edit", "setup", "delete", "site", "copy-id"]);
  });

  it("shows setup but not edit for catalogue-only staff on drafts", () => {
    const ids = buildSaleBoardMobileMenuItems(deletableDraft, { canManageSales: false }).map(
      (i) => i.id,
    );
    expect(ids).toEqual(["open", "setup", "site", "copy-id"]);
  });

  it("includes delete only when server marks row deletable", () => {
    expect(
      buildSaleBoardMobileMenuItems(deletableDraft, { canManageSales: true }).map((i) => i.id),
    ).toContain("delete");
    expect(
      buildSaleBoardMobileMenuItems(
        { ...deletableDraft, status: "scheduled" },
        { canManageSales: true },
      ).map((i) => i.id),
    ).toContain("delete");
    expect(
      buildSaleBoardMobileMenuItems(
        { ...deletableDraft, canDelete: false },
        { canManageSales: true },
      ).map((i) => i.id),
    ).not.toContain("delete");
  });

  it("omits edit for live sales without manage permission", () => {
    const ids = buildSaleBoardMobileMenuItems(
      { saleId: "s1", title: "Live sale", status: "active", canDelete: false },
      { canManageSales: false },
    ).map((i) => i.id);
    expect(ids).toEqual(["open", "site", "copy-id"]);
  });
});
