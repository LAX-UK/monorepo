import type { LegalEntitySummary } from "@auction/types";

export type ActingAccountChoice = {
  /** The account this request acts as. */
  acting: LegalEntitySummary;
  /**
   * The browser has no usable choice: no cookie yet (a new device), or one for an account the
   * person can no longer use. The client area then sends it through `/restore-account`.
   */
  needsRestore: boolean;
};

/**
 * Which of the person's accounts a request acts as: the one this browser chose, while the person
 * may still use it; otherwise their own, flagged for a restore. Pure, and only ever given a
 * successful accounts answer: an outage never reaches it, so it can never pick Personal because
 * the lookup failed.
 */
export function chooseActingAccount(input: {
  accounts: readonly LegalEntitySummary[];
  /** The account id in this browser's cookie; `null` on a new device. */
  browserAccountId: string | null;
  /** When off, organisations are hidden, so a stale organisation cookie is not usable. */
  orgModuleEnabled: boolean;
}): ActingAccountChoice | null {
  const { accounts, browserAccountId, orgModuleEnabled } = input;
  const chosen = browserAccountId
    ? accounts.find((account) => account.id === browserAccountId)
    : undefined;
  const usable = chosen !== undefined && (orgModuleEnabled || chosen.kind !== "organisation");
  if (usable) return { acting: chosen, needsRestore: false };

  const fallback = accounts.find((account) => account.kind === "individual") ?? accounts[0];
  return fallback ? { acting: fallback, needsRestore: true } : null;
}
