import type { AdminPayoutListSummary, IPayoutRepository } from "@auction/persistence/interfaces";
import type { Payout } from "@auction/types";
import type { AdminListPayoutsFilter } from "../interfaces/payout.js";

export type AdminPayoutListPage = {
  rows: Payout[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminPayoutListSummary;
};

/** Paginated admin payouts table read model (no mutation logic). */
export class AdminPayoutListQueryService {
  constructor(private readonly payouts: IPayoutRepository) {}

  async getPage(
    filter: AdminListPayoutsFilter & { limit: number; offset: number },
  ): Promise<AdminPayoutListPage> {
    const listFilter = {
      ...(filter.legalEntityId !== undefined ? { legalEntityId: filter.legalEntityId } : {}),
      ...(filter.status !== undefined ? { status: filter.status } : {}),
    };
    const [rows, total, summary] = await Promise.all([
      this.payouts.list({
        ...listFilter,
        limit: filter.limit,
        offset: filter.offset,
      }),
      this.payouts.countMatching(listFilter),
      this.payouts.summarizeMatching(listFilter),
    ]);
    return { rows, total, offset: filter.offset, limit: filter.limit, summary };
  }
}
