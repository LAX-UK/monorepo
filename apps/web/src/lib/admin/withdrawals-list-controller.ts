import type { LotWithdrawalRequestTask } from "@/lib/data/http/admin.server";
import { getLotWithdrawalRequests } from "@/lib/data/http/admin.server";

export type WithdrawalsListResult = {
  tasks: LotWithdrawalRequestTask[];
};

export const withdrawalsListController = {
  id: "withdrawals",
  async fetch(): Promise<WithdrawalsListResult> {
    const tasks = await getLotWithdrawalRequests();
    return { tasks };
  },
};
