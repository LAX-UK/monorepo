import type { CatalogMobileAction } from "@/components/admin/catalog";
import type { QuickActionItem } from "@/components/admin/detail-rail/quick-actions-rail";
import {
  type CatalogNavAction,
  type CatalogPrimaryMetaAction,
  catalogNavActionToQuickRailItem,
} from "@/lib/admin/catalog-nav-action-adapter";
import {
  adminSaleEditHref,
  adminSaleSetupHref,
  adminSaleroomHref,
} from "@/lib/admin/catalog-route-helpers";

export type SaleLifecycleActionKind = "publish" | "unpublish" | "markEnded" | "cancel" | "delete";

export type SaleLifecycleActionItem = {
  id: string;
  label: string;
  kind: SaleLifecycleActionKind;
};

type LifecycleFlags = {
  canPublish: boolean;
  canUnpublish: boolean;
  canMarkOnsiteEnded: boolean;
  canCancel: boolean;
  canDelete: boolean;
};

/** Ordered lifecycle actions for mobile — first item is the primary inline action. */
export function buildSaleLifecycleActionItems(flags: LifecycleFlags): SaleLifecycleActionItem[] {
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

export function saleLifecycleConfirmCopy(kind: SaleLifecycleActionKind) {
  switch (kind) {
    case "unpublish":
      return {
        title: "Revert sale to draft?",
        description: "All scheduled lots will also revert to draft.",
        actionLabel: "Revert to draft",
      };
    case "markEnded":
      return {
        title: "End onsite sale?",
        description: "This will end the sale and all remaining lots.",
        actionLabel: "Mark ended",
      };
    case "cancel":
      return {
        title: "Cancel entire sale?",
        description:
          "This stops the sale and remaining lots. Cancelled sales stay visible in admin lists with a cancelled status.",
        actionLabel: "Cancel sale",
      };
    default:
      return null;
  }
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
  /** When set for draft sales without edit access, links to setup instead of edit. */
  draftSetupHref?: string;
};

/** Navigation actions for sale detail mobile bar (non-lifecycle). */
export function buildSaleNavigationActionItems(flags: NavFlags): SaleNavigationActionItem[] {
  const items: SaleNavigationActionItem[] = [];
  if (flags.liveish) {
    items.push({
      id: "saleroom",
      label: "Open saleroom",
      href: adminSaleroomHref(flags.saleId),
      variant: "primary",
    });
  }
  if (flags.canEdit) {
    items.push({
      id: "edit",
      label: "Edit draft",
      href: adminSaleEditHref(flags.saleId),
      variant: flags.liveish ? "secondary" : "primary",
    });
  } else if (flags.draftSetupHref) {
    items.push({
      id: "setup",
      label: "Continue setup",
      href: flags.draftSetupHref,
      variant: flags.liveish ? "secondary" : "primary",
    });
  } else {
    items.push({
      id: "edit",
      label: "Edit details",
      href: adminSaleEditHref(flags.saleId),
      variant: flags.liveish ? "secondary" : "primary",
    });
  }
  items.push({
    id: "site",
    label: "View on site",
    href: flags.publicHref,
  });
  return items;
}

type DetailNavFlags = NavFlags & {
  isDraft: boolean;
  canManageSales: boolean;
};

function buildSaleQuickRailNavActions(flags: DetailNavFlags): CatalogNavAction[] {
  const items: CatalogNavAction[] = [];
  if (flags.liveish) {
    items.push({
      id: "saleroom",
      label: "Open saleroom",
      href: adminSaleroomHref(flags.saleId),
      railVariant: "default",
    });
  }
  if (flags.isDraft) {
    items.push({
      id: "setup",
      label: "Continue setup",
      href: flags.draftSetupHref ?? adminSaleSetupHref(flags.saleId),
      railVariant: "default",
    });
    if (flags.canManageSales) {
      items.push({
        id: "edit",
        label: "Edit draft",
        href: adminSaleEditHref(flags.saleId),
        railVariant: "outline",
      });
    }
  }
  items.push({
    id: "public",
    label: "View on site",
    href: flags.publicHref,
    railVariant: "outline",
  });
  return items;
}

export function buildSaleDetailNavActions(flags: DetailNavFlags): {
  barActions: SaleNavigationActionItem[];
  quickRailItems: QuickActionItem[];
  primaryMetaAction: CatalogPrimaryMetaAction | null;
} {
  const barActions = buildSaleNavigationActionItems(flags);
  const quickRailItems = buildSaleQuickRailNavActions(flags).map(catalogNavActionToQuickRailItem);

  const primaryMetaAction: CatalogPrimaryMetaAction | null = flags.liveish
    ? { label: "Open saleroom →", href: adminSaleroomHref(flags.saleId) }
    : flags.canEdit
      ? { label: "Edit draft →", href: adminSaleEditHref(flags.saleId) }
      : flags.isDraft && flags.draftSetupHref
        ? { label: "Continue setup →", href: flags.draftSetupHref }
        : null;

  return { barActions, quickRailItems, primaryMetaAction };
}

/** Map bar nav items to catalog mobile bar shape. */
export function saleNavItemsToMobileBar(items: SaleNavigationActionItem[]): CatalogMobileAction[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    ...(item.variant ? { variant: item.variant } : {}),
  }));
}
