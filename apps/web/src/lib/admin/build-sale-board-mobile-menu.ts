import {
  adminSaleEditHref,
  adminSaleHref,
  adminSaleSetupHref,
} from "@/lib/admin/catalog-route-helpers";
import { salePath } from "@/lib/seo/url";
import type { SaleStatus } from "@auction/types";

export type SaleBoardMobileMenuItemKind = "open" | "edit" | "setup" | "delete" | "site" | "copyId";

export type SaleBoardMobileMenuItem = {
  id: string;
  label: string;
  kind: SaleBoardMobileMenuItemKind;
  href: string;
};

type Row = {
  saleId: string;
  title: string;
  status: SaleStatus;
  canDelete?: boolean;
};

type Flags = {
  canManageSales: boolean;
};

/** Overflow menu items for sale list board rows — aligned with detail nav RBAC. */
export function buildSaleBoardMobileMenuItems(row: Row, flags: Flags): SaleBoardMobileMenuItem[] {
  const items: SaleBoardMobileMenuItem[] = [
    {
      id: "open",
      label: "Open",
      kind: "open",
      href: adminSaleHref(row.saleId),
    },
  ];

  if (row.status === "draft") {
    if (flags.canManageSales) {
      items.push({
        id: "edit",
        label: "Edit draft",
        kind: "edit",
        href: adminSaleEditHref(row.saleId),
      });
    }
    items.push({
      id: "setup",
      label: "Continue setup",
      kind: "setup",
      href: adminSaleSetupHref(row.saleId),
    });
  } else if (flags.canManageSales && row.status === "scheduled") {
    items.push({
      id: "edit",
      label: "Edit",
      kind: "edit",
      href: adminSaleEditHref(row.saleId),
    });
  }

  if (flags.canManageSales && row.canDelete) {
    items.push({
      id: "delete",
      label: "Delete sale",
      kind: "delete",
      href: row.saleId,
    });
  }

  items.push(
    {
      id: "site",
      label: "View on site",
      kind: "site",
      href: salePath({ id: row.saleId, title: row.title }),
    },
    {
      id: "copy-id",
      label: "Copy sale ID",
      kind: "copyId",
      href: row.saleId,
    },
  );

  return items;
}
