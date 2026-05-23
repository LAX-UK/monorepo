import type { CatalogMobileAction } from "@/components/admin/catalog";

type Flags = {
  lotId: string;
  publicHref: string;
  canEditDraft: boolean;
  canEditLot: boolean;
  showEditCatalog: boolean;
};

/** Navigation actions for lot detail mobile bar (lifecycle actions use trailing slot). */
export function buildLotMobileActions(flags: Flags): CatalogMobileAction[] {
  const actions: CatalogMobileAction[] = [];

  if (flags.canEditDraft) {
    actions.push({
      id: "edit-draft",
      label: "Edit draft",
      href: `/admin/lots/${flags.lotId}/edit`,
      variant: "primary",
    });
  } else if (flags.canEditLot) {
    actions.push({
      id: "edit-lot",
      label: "Edit lot",
      href: `/admin/lots/${flags.lotId}/edit`,
      variant: "primary",
    });
  } else if (flags.showEditCatalog) {
    actions.push({
      id: "edit-catalog",
      label: "Edit catalog copy",
      href: `/admin/lots/${flags.lotId}/edit/catalog`,
      variant: "primary",
    });
  }

  actions.push({
    id: "duplicate",
    label: "Duplicate",
    href: `/admin/lots/new?fromLot=${encodeURIComponent(flags.lotId)}`,
  });
  actions.push({
    id: "site",
    label: "View on site",
    href: flags.publicHref,
  });

  return actions;
}
