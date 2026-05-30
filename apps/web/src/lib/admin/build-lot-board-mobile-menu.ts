import {
  adminLotEditCatalogHref,
  adminLotEditHref,
  adminLotHref,
} from "@/lib/admin/catalog-route-helpers";
import { lotPath } from "@/lib/seo/url";
import type { LotStatus } from "@auction/types";

export type LotBoardMobileMenuItemKind = "open" | "edit" | "images" | "publish" | "site" | "copyId";

export type LotBoardMobileMenuItem = {
  id: string;
  label: string;
  kind: LotBoardMobileMenuItemKind;
  href: string;
};

type Row = {
  id: string;
  title: string;
  status: LotStatus;
};

type Flags = {
  canManageCatalog: boolean;
};

function lotEditHrefForStatus(lotId: string, status: LotStatus): string | null {
  if (status === "draft" || status === "scheduled") return adminLotEditHref(lotId);
  if (status === "active") return adminLotEditCatalogHref(lotId);
  return null;
}

/** Overflow menu items for lot list board rows — aligned with detail nav RBAC. */
export function buildLotBoardMobileMenuItems(row: Row, flags: Flags): LotBoardMobileMenuItem[] {
  const items: LotBoardMobileMenuItem[] = [
    {
      id: "open",
      label: "Open",
      kind: "open",
      href: adminLotHref(row.id),
    },
  ];

  const editHref = flags.canManageCatalog ? lotEditHrefForStatus(row.id, row.status) : null;
  if (editHref) {
    items.push({
      id: "edit",
      label: row.status === "active" ? "Edit catalog copy" : "Edit",
      kind: "edit",
      href: editHref,
    });
  }

  if (flags.canManageCatalog && row.status === "draft") {
    items.push(
      {
        id: "images",
        label: "Add images",
        kind: "images",
        href: `${adminLotHref(row.id)}/images`,
      },
      {
        id: "publish",
        label: "Publish",
        kind: "publish",
        href: `${adminLotHref(row.id)}?focus=publish`,
      },
    );
  }

  items.push(
    {
      id: "site",
      label: "View on site",
      kind: "site",
      href: lotPath({ id: row.id, title: row.title }),
    },
    {
      id: "copy-id",
      label: "Copy lot ID",
      kind: "copyId",
      href: row.id,
    },
  );

  return items;
}
