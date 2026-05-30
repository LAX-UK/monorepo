import { describe, expect, it } from "vitest";
import { buildLotBoardMobileMenuItems } from "./build-lot-board-mobile-menu";

describe("buildLotBoardMobileMenuItems", () => {
  const row = { id: "lot-1", title: "Test lot", status: "draft" as const };

  it("includes edit, images, and publish for catalogue staff on draft lots", () => {
    const ids = buildLotBoardMobileMenuItems(row, { canManageCatalog: true }).map((i) => i.id);
    expect(ids).toEqual(["open", "edit", "images", "publish", "site", "copy-id"]);
  });

  it("omits edit and publish when catalogue manage is denied", () => {
    const ids = buildLotBoardMobileMenuItems(row, { canManageCatalog: false }).map((i) => i.id);
    expect(ids).toEqual(["open", "site", "copy-id"]);
  });

  it("uses catalog copy edit for active lots", () => {
    const items = buildLotBoardMobileMenuItems(
      { ...row, status: "active" },
      { canManageCatalog: true },
    );
    expect(items.find((i) => i.id === "edit")).toMatchObject({
      label: "Edit catalog copy",
      href: "/admin/lots/lot-1/edit/catalog",
    });
    expect(items.some((i) => i.id === "publish")).toBe(false);
  });
});
