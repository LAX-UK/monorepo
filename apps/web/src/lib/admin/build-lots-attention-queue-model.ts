import { buildListHref } from "@/lib/admin/admin-list-params";
import { adminLotListPath } from "@/lib/admin/catalog-routes";
import { lotLensHref } from "@/lib/admin/catalog/lots-lenses";

export type LotsAttentionQueueChip = {
  id: string;
  label: string;
  href: string;
  count?: number;
};

export function buildLotsAttentionQueueModel(input: {
  sp: Record<string, string | string[] | undefined>;
  withdrawalsPending: number;
  draftsMissingPhotos: number;
}): LotsAttentionQueueChip[] {
  const { sp, withdrawalsPending, draftsMissingPhotos } = input;
  const chips: LotsAttentionQueueChip[] = [];

  if (withdrawalsPending > 0) {
    chips.push({
      id: "withdrawals",
      label: "Withdrawal requests",
      href: buildListHref(adminLotListPath(), sp, {
        lens: "attention",
        withdrawal: "pending",
        status: "",
        needsPhotos: "",
        offset: 0,
      }),
      count: withdrawalsPending,
    });
  }

  if (draftsMissingPhotos > 0) {
    chips.push({
      id: "missing-photos",
      label: "Drafts missing photos",
      href: lotLensHref("attention", sp),
      count: draftsMissingPhotos,
    });
  }

  return chips;
}
