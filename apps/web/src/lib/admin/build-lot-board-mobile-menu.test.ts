import { describe, expect, it } from "vitest";
import { buildLotBoardMobileMenuItems } from "./build-lot-board-mobile-menu";

describe("buildLotBoardMobileMenuItems", () => {
  const row = { id: "lot-1", title: "Test lot", status: "draft" as const, canDelete: true };
  const noAuction = { canManageCatalog: false, canManageAuction: false };
  const catalogOnly = { canManageCatalog: true, canManageAuction: false };
  const auctionManager = { canManageCatalog: true, canManageAuction: true };

  it("includes edit, images, and publish for catalogue staff on draft lots", () => {
    const ids = buildLotBoardMobileMenuItems(row, catalogOnly).map((i) => i.id);
    expect(ids).toEqual(["open", "edit", "images", "publish", "site", "copy-id"]);
  });

  it("includes delete for auction managers when server marks row deletable", () => {
    const ids = buildLotBoardMobileMenuItems(row, auctionManager).map((i) => i.id);
    expect(ids).toContain("delete");
  });

  it("omits delete when server marks row not deletable", () => {
    const ids = buildLotBoardMobileMenuItems(
      { ...row, canDelete: false },
      auctionManager,
    ).map((i) => i.id);
    expect(ids).not.toContain("delete");
  });

  it("omits edit and publish when catalogue manage is denied", () => {
    const ids = buildLotBoardMobileMenuItems(row, noAuction).map((i) => i.id);
    expect(ids).toEqual(["open", "site", "copy-id"]);
  });

  it("uses catalog copy edit for active lots", () => {
    const items = buildLotBoardMobileMenuItems(
      { ...row, status: "active", canDelete: false },
      catalogOnly,
    );
    expect(items.find((i) => i.id === "edit")).toMatchObject({
      label: "Edit catalog copy",
      href: "/admin/lots/lot-1/edit/catalog",
    });
    expect(items.some((i) => i.id === "publish")).toBe(false);
    expect(items.some((i) => i.id === "delete")).toBe(false);
  });
});
