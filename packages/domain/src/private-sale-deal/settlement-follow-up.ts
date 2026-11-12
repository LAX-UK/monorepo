import type { PrivateSaleDealStage } from "@auction/types";

/** How a settled deal whose artwork is not recorded sold should be treated. */
export const SETTLEMENT_FOLLOW_UP_SEVERITIES = ["normal", "urgent"] as const;
export type SettlementFollowUpSeverity = (typeof SETTLEMENT_FOLLOW_UP_SEVERITIES)[number];

/** What the artwork register says about the deal's artwork, as stored. */
export type SettlementRegisterFacts = {
  kind: string;
  offerState: string;
  offerRefKind: string | null;
  offerRefId: string | null;
};

export type SettlementDealFacts = {
  id: string;
  stage: PrivateSaleDealStage;
  artworkRegisterId: string | null;
};

/** The places an artwork can rest without anyone else having a claim on it. */
const FREE_OFFER_STATES: readonly string[] = ["held", "withdrawn"];

function isRecordedFor(register: SettlementRegisterFacts, dealId: string, state: string): boolean {
  return (
    register.offerState === state &&
    register.offerRefKind === "private_sale" &&
    register.offerRefId === dealId
  );
}

/**
 * A settled deal whose artwork the register does not show as sold through that deal. It is never
 * stored: it is true while the register disagrees and stops being true the moment it is right.
 *
 * `urgent` means the register now shows the artwork somewhere else (offered in another place, or
 * sold some other way), so it may have been sold twice. Nothing is moved on staff's behalf then.
 * Otherwise the artwork is still held for this deal, or free, and marking it sold is safe to retry.
 */
export function settlementFollowUp(
  deal: SettlementDealFacts,
  register: SettlementRegisterFacts | null,
): SettlementFollowUpSeverity | null {
  if (deal.stage !== "settled" || deal.artworkRegisterId === null || register === null) return null;
  // Prints are sold in runs, not one place at a time: the register does not govern them.
  if (register.kind !== "original") return null;
  if (isRecordedFor(register, deal.id, "sold")) return null;
  if (FREE_OFFER_STATES.includes(register.offerState)) return "normal";
  if (isRecordedFor(register, deal.id, "private_sale")) return "normal";
  return "urgent";
}

export const isUrgentSettlementFollowUp = (
  severity: SettlementFollowUpSeverity | null,
): severity is "urgent" => severity === "urgent";
