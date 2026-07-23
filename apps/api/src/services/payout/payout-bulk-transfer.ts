import { runBulkSettlementWithTransfers as runBulkShared } from "@auction/finance-runtime";
import type {
  BulkSettlementTransferPort,
  BulkSettlementWithTransfersResult,
} from "../interfaces/payout.js";
import { toPayoutSettlementDeps } from "./finance-payout-bridge.js";
import type { PayoutServiceDeps } from "./payout-helpers.js";

export { outcomeFromTransfer } from "@auction/finance-runtime";

export async function runBulkSettlementWithTransfers(
  deps: PayoutServiceDeps,
  actorUserId: string | null,
  port: BulkSettlementTransferPort,
  opts?: { periodEnd?: Date },
): Promise<BulkSettlementWithTransfersResult> {
  return runBulkShared(toPayoutSettlementDeps(deps), actorUserId, port, opts);
}
