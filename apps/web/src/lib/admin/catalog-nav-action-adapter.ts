import type { CatalogMobileAction } from "@/components/admin/catalog";
import type { QuickActionItem } from "@/components/admin/detail-rail/quick-actions-rail";

export type CatalogNavAction = {
  id: string;
  label: string;
  href: string;
  barVariant?: CatalogMobileAction["variant"];
  railVariant?: QuickActionItem["variant"];
};

export function catalogNavActionToMobileBar(action: CatalogNavAction): CatalogMobileAction {
  return {
    id: action.id,
    label: action.label,
    href: action.href,
    ...(action.barVariant ? { variant: action.barVariant } : {}),
  };
}

export function catalogNavActionToQuickRailItem(action: CatalogNavAction): QuickActionItem {
  return {
    id: action.id,
    label: action.label,
    href: action.href,
    variant: action.railVariant ?? "outline",
  };
}

export type CatalogPrimaryMetaAction = {
  label: string;
  href: string;
};
