import type { AdminListQueryBase } from "@/lib/admin/i-admin-list-controller";
import type { SaleStatus } from "@auction/types";

export type SaleLifecycleSlug = "upcoming" | "live" | "closed" | "settled";

export type SalesListQuery = AdminListQueryBase & {
  status?: SaleStatus | undefined;
  /** Mutually exclusive with raw `status` for URL bookmarking — derived into `status` for fetch */
  lifecycle?: SaleLifecycleSlug | undefined;
  /** Server-side filter — online | onsite */
  delivery?: "online" | "onsite" | undefined;
  needsSetup?: boolean | undefined;
};
