/** Whose payouts are being set up: a person selling in their own name, or an organisation. */
export type PayoutSetupAccount = "personal" | "organisation";

export type PayoutSetupStepId = "identity" | "bank_details" | "people";

export type PayoutSetupStep = { id: PayoutSetupStepId; label: string; done: boolean };

export type PayoutSetupProgress = {
  /** The person's identity check is approved (personal sellers only). */
  identityChecked: boolean;
  /** The payout account can receive payouts. */
  payoutsReady: boolean;
};

const STEP_LABELS: Record<PayoutSetupStepId, string> = {
  identity: "Check your identity",
  bank_details: "Add your bank details",
  people: "Confirm who runs the organisation",
};

/** The steps each account goes through, in order, and when each one counts as done. */
const STEPS: Record<
  PayoutSetupAccount,
  readonly { id: PayoutSetupStepId; done: (progress: PayoutSetupProgress) => boolean }[]
> = {
  personal: [
    { id: "identity", done: (p) => p.identityChecked },
    { id: "bank_details", done: (p) => p.payoutsReady },
  ],
  organisation: [
    { id: "bank_details", done: (p) => p.payoutsReady },
    { id: "people", done: (p) => p.payoutsReady },
  ],
};

/** The plain steps to set up payouts, with where the account is. */
export function payoutSetupSteps(
  account: PayoutSetupAccount,
  progress: PayoutSetupProgress,
): PayoutSetupStep[] {
  return STEPS[account].map(({ id, done }) => ({
    id,
    label: STEP_LABELS[id],
    done: done(progress),
  }));
}
