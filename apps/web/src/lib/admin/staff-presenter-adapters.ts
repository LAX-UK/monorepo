/**
 * Staff presenter adapter registry — single import surface for status/tab/capability
 * presenters used by shells and boards. Keeps route components free of label maps.
 */
export { ADMIN_STATUS_REGISTRY } from "@/lib/presenters/status/admin-status-registry";
export type { AdminStatusDomain } from "@/lib/presenters/status/core";

export { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";

export { LOT_AUCTION_TYPE_REGISTRY } from "@/lib/presenters/lot-auction-type/lot-auction-type-registry";

export {
  capabilityDescription,
  capabilityLabel,
  capabilityPresentation,
} from "@/lib/admin/capability-presenter";

/** Shell variant → layout contract for substitution tests. */
export const STAFF_SHELL_VARIANT_LAYOUT: Record<
  import("@/lib/admin/staff-shell-variants.types").StaffListShellVariant,
  "catalog-list" | "staff-hub"
> = {
  catalog: "catalog-list",
  queue: "catalog-list",
  people: "catalog-list",
  finance: "catalog-list",
  hub: "staff-hub",
};
