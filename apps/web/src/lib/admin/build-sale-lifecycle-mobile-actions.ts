export type SaleLifecycleActionKind = "publish" | "unpublish" | "markEnded" | "cancel" | "delete";

export type SaleLifecycleActionItem = {
  id: string;
  label: string;
  kind: SaleLifecycleActionKind;
};

type Flags = {
  canPublish: boolean;
  canUnpublish: boolean;
  canMarkOnsiteEnded: boolean;
  canCancel: boolean;
  canDelete: boolean;
};

/** Ordered lifecycle actions for mobile — first item is the primary inline action. */
export function buildSaleLifecycleActionItems(flags: Flags): SaleLifecycleActionItem[] {
  const items: SaleLifecycleActionItem[] = [];
  if (flags.canPublish) {
    items.push({ id: "publish", label: "Publish", kind: "publish" });
  }
  if (flags.canUnpublish) {
    items.push({ id: "unpublish", label: "Revert to draft", kind: "unpublish" });
  }
  if (flags.canMarkOnsiteEnded) {
    items.push({ id: "mark-ended", label: "End sale", kind: "markEnded" });
  }
  if (flags.canCancel) {
    items.push({ id: "cancel", label: "Cancel sale", kind: "cancel" });
  }
  if (flags.canDelete) {
    items.push({ id: "delete", label: "Delete sale", kind: "delete" });
  }
  return items;
}

export type SaleNavigationActionItem = {
  id: string;
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type NavFlags = {
  saleId: string;
  publicHref: string;
  canEdit: boolean;
  liveish: boolean;
};

/** Navigation actions for sale detail mobile bar (non-lifecycle). */
export function buildSaleNavigationActionItems(flags: NavFlags): SaleNavigationActionItem[] {
  const items: SaleNavigationActionItem[] = [];
  if (flags.liveish) {
    items.push({
      id: "saleroom",
      label: "Open saleroom",
      href: `/admin/saleroom/${flags.saleId}`,
      variant: "primary",
    });
  }
  items.push({
    id: "edit",
    label: flags.canEdit ? "Edit draft" : "Edit details",
    href: `/admin/sales/${flags.saleId}/edit`,
    variant: flags.liveish ? "secondary" : "primary",
  });
  items.push({
    id: "site",
    label: "View on site",
    href: flags.publicHref,
  });
  return items;
}
