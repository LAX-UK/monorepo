import type { CatalogMobileAction } from "@/components/admin/catalog";
import type { QuickActionItem } from "@/components/admin/detail-rail/quick-actions-rail";
import {
  type CatalogNavAction,
  type CatalogPrimaryMetaAction,
  catalogNavActionToMobileBar,
  catalogNavActionToQuickRailItem,
} from "@/lib/admin/catalog-nav-action-adapter";
import {
  adminLotEditCatalogHref,
  adminLotEditHref,
  adminLotNewHref,
} from "@/lib/admin/catalog-route-helpers";

type Flags = {
  lotId: string;
  publicHref: string;
  canEditDraft: boolean;
  canEditLot: boolean;
  showEditCatalog: boolean;
};

function buildLotNavActions(flags: Flags): CatalogNavAction[] {
  const actions: CatalogNavAction[] = [];

  if (flags.canEditDraft) {
    actions.push({
      id: "edit-draft",
      label: "Edit draft",
      href: adminLotEditHref(flags.lotId),
      barVariant: "primary",
      railVariant: "default",
    });
  } else if (flags.canEditLot) {
    actions.push({
      id: "edit-lot",
      label: "Edit lot",
      href: adminLotEditHref(flags.lotId),
      barVariant: "primary",
      railVariant: "outline",
    });
  } else if (flags.showEditCatalog) {
    actions.push({
      id: "edit-catalog",
      label: "Edit catalog copy",
      href: adminLotEditCatalogHref(flags.lotId),
      barVariant: "primary",
      railVariant: "outline",
    });
  }

  actions.push({
    id: "duplicate",
    label: "Duplicate",
    href: adminLotNewHref({ fromLot: flags.lotId }),
  });
  actions.push({
    id: "site",
    label: "View on site",
    href: flags.publicHref,
    railVariant: "outline",
  });

  return actions;
}

/** Navigation actions for lot detail mobile bar (lifecycle actions use trailing slot). */
export function buildLotMobileActions(flags: Flags): CatalogMobileAction[] {
  return buildLotNavActions(flags).map(catalogNavActionToMobileBar);
}

export function buildLotDetailNavActions(flags: Flags): {
  barActions: CatalogMobileAction[];
  quickRailItems: QuickActionItem[];
  primaryMetaAction: CatalogPrimaryMetaAction | null;
} {
  const navActions = buildLotNavActions(flags);
  const primaryEdit = navActions.find((a) => a.id.startsWith("edit-"));
  const quickRailItems = navActions
    .filter((a) => a.id !== "duplicate")
    .map(catalogNavActionToQuickRailItem);

  return {
    barActions: navActions.map(catalogNavActionToMobileBar),
    quickRailItems,
    primaryMetaAction: primaryEdit
      ? { label: `${primaryEdit.label} →`, href: primaryEdit.href }
      : null,
  };
}

export type LotLifecycleActionKind = "publish" | "cancel";

export type LotLifecycleActionItem = {
  id: string;
  label: string;
  kind: LotLifecycleActionKind;
};

type LifecycleFlags = {
  canPublish: boolean;
  canCancel: boolean;
  /** When lot belongs to a draft sale, publish is via sale publish. */
  publishViaSale?: boolean;
};

export function buildLotLifecycleActionItems(flags: LifecycleFlags): LotLifecycleActionItem[] {
  const items: LotLifecycleActionItem[] = [];
  if (flags.canPublish && !flags.publishViaSale) {
    items.push({ id: "publish", label: "Publish", kind: "publish" });
  }
  if (flags.canCancel) {
    items.push({ id: "cancel", label: "Cancel lot", kind: "cancel" });
  }
  return items;
}
