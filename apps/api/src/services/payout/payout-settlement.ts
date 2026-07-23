import {
  createSettlement as createSettlementShared,
  runBulkSettlement as runBulkSettlementShared,
} from "@auction/finance-runtime";
import type {
  BulkPayoutSettlementResult,
  CreateSettlementInput,
  CreateSettlementResult,
} from "../interfaces/payout.js";
import { toPayoutSettlementDeps } from "./finance-payout-bridge.js";
import type { PayoutServiceDeps } from "./payout-helpers.js";

export { createSettlementCore } from "@auction/finance-runtime";

export async function createSettlement(
  deps: PayoutServiceDeps,
  actorUserId: string | null,
  input: CreateSettlementInput,
): Promise<CreateSettlementResult> {
  return createSettlementShared(toPayoutSettlementDeps(deps), actorUserId, input);
}

export async function runBulkSettlement(
  deps: PayoutServiceDeps,
  actorUserId: string | null,
  opts?: { periodEnd?: Date },
): Promise<BulkPayoutSettlementResult> {
  return runBulkSettlementShared(toPayoutSettlementDeps(deps), actorUserId, opts);
}
