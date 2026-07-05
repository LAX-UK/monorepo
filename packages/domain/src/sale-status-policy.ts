import type { Sale } from "@auction/types";

export const SALE_CANCELLABLE: ReadonlySet<Sale["status"]> = new Set([
  "draft",
  "scheduled",
  "active",
]);

export const SALE_STATUSES_ALLOWING_LOT_ADD: ReadonlySet<Sale["status"]> = new Set([
  "draft",
  "scheduled",
  "active",
]);
