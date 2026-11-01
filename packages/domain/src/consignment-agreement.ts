import type { LegalEntityStatus } from "@auction/types";
import { type AccountStanding, accountStatePolicy } from "./account-state-policy.js";
import { type EntityActor, entityActorCan } from "./entity-capabilities.js";

/**
 * Version 1 of the consignment agreement is Part C of the Conditions of Business ("Conditions
 * for Sellers and Consignors"). A new wording gets a new version here; acceptances keep the
 * version they were given.
 */
export const CONSIGNMENT_AGREEMENT_TERMS_VERSION = "conditions-of-business-part-c-v1";

/** The facts about an agreement that its rules depend on. */
export type ConsignmentAgreementFacts = {
  legalEntityId: string;
  termsVersion: string;
  acceptedAt: Date | null;
  estimateLow: string | null;
  estimateHigh: string | null;
  commissionPercent: string | null;
};

/**
 * A seller is asked to accept only real terms: an estimate (low and high) and the seller's
 * commission. Proposals recorded without them (for example works accepted before agreements
 * existed) wait for the specialist to add them.
 */
export function agreementTermsComplete(
  agreement: Pick<ConsignmentAgreementFacts, "estimateLow" | "estimateHigh" | "commissionPercent">,
): boolean {
  return Boolean(agreement.estimateLow && agreement.estimateHigh && agreement.commissionPercent);
}

export type AgreementAcceptanceInput = {
  agreement: ConsignmentAgreementFacts | null;
  /** The account the person is acting for. */
  actingLegalEntityId: string;
  /** Their standing with that account; `null` for their own personal profile. */
  actor: EntityActor | null;
  /** The version the person read and is accepting. */
  termsVersion: string;
};

export type AgreementAcceptanceRefusal =
  | "not_found"
  | "not_proposed"
  | "incomplete_terms"
  | "forbidden_role"
  | "stale_terms";

export type AgreementAcceptanceDecision =
  | { kind: "accept" }
  /** Accepting twice is harmless: the first acceptance stands and nothing is recorded again. */
  | { kind: "already_accepted" }
  | { kind: "refused"; reason: AgreementAcceptanceRefusal; message: string };

const REFUSAL_MESSAGES: Record<AgreementAcceptanceRefusal, string> = {
  not_found: "This consignment is not in the account you are using.",
  not_proposed: "The specialist has not proposed terms for this consignment yet.",
  incomplete_terms: "Your specialist hasn't sent the estimate and terms yet.",
  forbidden_role: "Only an owner or admin can accept the consignment agreement.",
  stale_terms: "The agreement has changed since you opened it. Read it again before accepting.",
};

function refuse(reason: AgreementAcceptanceRefusal): AgreementAcceptanceDecision {
  return { kind: "refused", reason, message: REFUSAL_MESSAGES[reason] };
}

/** Whether `actor` may accept agreements for the account; a person's own profile always may. */
export function canAcceptConsignmentAgreement(actor: EntityActor | null): boolean {
  return actor === null || entityActorCan(actor, "entity.consignments.accept_agreement");
}

/**
 * Why the account's state holds accepting an agreement, whoever the member is: selling is paused
 * (restricted), LAX is still checking the organisation, payouts are not set up yet, or the
 * account is closed.
 */
export type AgreementAcceptanceHold = "paused" | "checking" | "payouts" | "closed";

const HOLD_BY_STATUS: Readonly<Record<LegalEntityStatus, AgreementAcceptanceHold | null>> = {
  lead: "checking",
  docs_requested: "checking",
  docs_received: "checking",
  under_review: "checking",
  connect_pending: "payouts",
  approved: null,
  restricted: "paused",
  rejected: "closed",
  archived: "closed",
};

/** The hold on accepting for this account, or `null` while its state allows it. */
export function agreementAcceptanceHold(
  account: Pick<AccountStanding, "kind" | "status">,
): AgreementAcceptanceHold | null {
  const state = accountStatePolicy({ ...account, payoutsReady: true }, new Set());
  return state.actions.accept_agreement ? null : (HOLD_BY_STATUS[account.status] ?? "closed");
}

/** Who may accept, which account, which version, and whether it was already accepted. */
export function decideAgreementAcceptance(
  input: AgreementAcceptanceInput,
): AgreementAcceptanceDecision {
  const { agreement } = input;
  if (agreement && agreement.legalEntityId !== input.actingLegalEntityId) {
    return refuse("not_found");
  }
  if (!agreement) return refuse("not_proposed");
  if (!canAcceptConsignmentAgreement(input.actor)) return refuse("forbidden_role");
  if (agreement.acceptedAt) return { kind: "already_accepted" };
  if (!agreementTermsComplete(agreement)) return refuse("incomplete_terms");
  if (agreement.termsVersion !== input.termsVersion) return refuse("stale_terms");
  return { kind: "accept" };
}

export const AGREEMENT_NOT_ACCEPTED_MESSAGE =
  "Waiting for the seller to accept the consignment agreement. The lot can be catalogued once they accept.";

/** A lot is catalogued only from an accepted agreement. */
export function agreementAllowsCataloguing(
  agreement: Pick<ConsignmentAgreementFacts, "acceptedAt"> | null,
): boolean {
  return Boolean(agreement?.acceptedAt);
}

/** Reminders go out on these days after the proposal, once each, until the seller accepts. */
export const AGREEMENT_REMINDER_DAYS = [3, 7] as const;
export type AgreementReminderDay = (typeof AGREEMENT_REMINDER_DAYS)[number];

export type AgreementReminderFacts = {
  proposedAt: Date;
  acceptedAt: Date | null;
  reminderDay3SentAt: Date | null;
  reminderDay7SentAt: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function reminderSentAt(facts: AgreementReminderFacts, day: AgreementReminderDay): Date | null {
  return day === 3 ? facts.reminderDay3SentAt : facts.reminderDay7SentAt;
}

/**
 * The reminder due now, if any. When several are overdue (the job did not run for a while),
 * only the latest is sent: one email that says the same thing as the missed one.
 */
export function dueAgreementReminder(
  facts: AgreementReminderFacts,
  now: Date,
): AgreementReminderDay | null {
  if (facts.acceptedAt) return null;
  const ageMs = now.getTime() - facts.proposedAt.getTime();
  const due = [...AGREEMENT_REMINDER_DAYS]
    .reverse()
    .find((day) => ageMs >= day * DAY_MS && !reminderSentAt(facts, day));
  if (due === undefined) return null;
  // A later reminder already went out: never send an earlier one after it.
  const laterSent = AGREEMENT_REMINDER_DAYS.some(
    (day) => day > due && reminderSentAt(facts, day) !== null,
  );
  return laterSent ? null : due;
}
