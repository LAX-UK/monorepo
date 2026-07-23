import type { IAmlHoldStore } from "@auction/persistence/interfaces";
import type { IKycService } from "./kyc-service.js";
import type { ISourceOfFundsGateService } from "./source-of-funds-service.js";

/**
 * Participation gates use AML hold reads only (no screening decisions on bid path).
 */
export type AmlHoldParticipationReadPort = Pick<IAmlHoldStore, "getHold">;

/** Sale registration / telephone booking KYC peek (no session creation). */
export type KycParticipationReadPort = Pick<IKycService, "getStatus" | "getLatestForUser">;

/**
 * Settlement path: `peek*` methods are read-only; `requiresSourceOfFunds` / case checks may
 * create or advance cases when invoked from payment evaluate flows.
 */
export type SourceOfFundsSettlementGatePort = Pick<
  ISourceOfFundsGateService,
  "requiresSourceOfFunds" | "hasPendingCaseForUser"
>;

export type SourceOfFundsSettlementPeekPort = Pick<
  ISourceOfFundsGateService,
  "hasPendingCaseForUser"
>;
