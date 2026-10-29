import type { LegalEntitySummary } from "@auction/types";

/**
 * Why the person's accounts could not be read. Each one is an outage, never an answer: the
 * workspace shows a retry state and keeps the account the browser already uses.
 */
export type AccountsUnavailableReason =
  /** The API asked us to slow down, and still did after one retry. */
  | "rate_limited"
  /** The API answered with an error, or could not prepare the person's own account. */
  | "server_error"
  /** The API took too long to answer. */
  | "timeout"
  /** The API could not be reached. */
  | "network";

/** Every account the signed-in person may use, or why they could not be read. */
export type AccountsLookup =
  | { ok: true; accounts: readonly LegalEntitySummary[] }
  | { ok: false; reason: AccountsUnavailableReason };

/** The account a staff member is viewing as, while their view-as session is live. */
export type ViewedAccount = {
  account: LegalEntitySummary;
  /** When the session ends; `null` when the API did not say. */
  expiresAtIso: string | null;
};

/**
 * Where the signed-in person's accounts come from. The acting-context resolver depends on this
 * port only, so it can be tested with a fake and the HTTP adapter can cache and retry on its own.
 */
export interface AccountDirectory {
  /**
   * Every account the person may use. `mustInclude` names an account the caller expects (the
   * one this browser uses, or one it is switching to): a cached answer without it is re-read,
   * so an invitation accepted a moment ago is never mistaken for a lost membership.
   */
  listMine(options?: { mustInclude?: string | null }): Promise<AccountsLookup>;
  /** The account a staff member is viewing as; `null` when the session is not live. */
  findViewedAccount(accountId: string): Promise<ViewedAccount | null>;
}
