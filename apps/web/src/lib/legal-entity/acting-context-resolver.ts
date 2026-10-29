import type { LegalEntitySummary } from "@auction/types";
import type { AccountDirectory, AccountsUnavailableReason } from "./account-directory";
import { chooseActingAccount } from "./choose-acting-account";

export type ResolvedActingImpersonation = {
  displayName: string;
  expiresAtIso: string;
  sessionId: string;
};

export type ResolvedActingContext = {
  /** The account this request acts as. */
  acting: LegalEntitySummary;
  /** Every account the person may use (the switcher lists them). */
  memberships: readonly LegalEntitySummary[];
  /** A staff member's live "view as client" session, if any. */
  impersonation: ResolvedActingImpersonation | null;
  /**
   * This browser has no usable account choice: no cookie yet (a new device) or one for an
   * account the person can no longer use. The client area then sends it through
   * `/restore-account`, which opens the remembered account or explains the fallback.
   */
  needsRestore: boolean;
};

/** One request's answer: the acting context, or why the accounts could not be read. */
export type ActingContextLookup =
  | { ok: true; context: ResolvedActingContext }
  | { ok: false; reason: AccountsUnavailableReason };

/** What this browser's acting cookie says. */
export type BrowserAccountChoice = {
  accountId: string;
  /** A staff "view as client" session id, when the cookie carries one. */
  viewSessionId: string | null;
};

export type ActingContextDeps = {
  directory: AccountDirectory;
  /** The browser's acting cookie, decoded; `null` when there is none. */
  browserChoice: BrowserAccountChoice | null;
  orgModuleEnabled: () => Promise<boolean>;
  /** Whether this person may hold a staff view-as session at all. */
  canViewAsClient: boolean;
};

/**
 * Resolves the account a request acts as. A failed accounts lookup is returned as a failure and
 * never replaced by the person's own account: showing Personal while the browser still acts for
 * an organisation is the one outcome this must never produce.
 */
export async function resolveActingContextWith(
  deps: ActingContextDeps,
): Promise<ActingContextLookup> {
  const { directory, browserChoice } = deps;
  const lookup = await directory.listMine({ mustInclude: browserChoice?.accountId ?? null });
  if (!lookup.ok) return lookup;

  if (browserChoice?.viewSessionId && deps.canViewAsClient) {
    const viewed = await directory.findViewedAccount(browserChoice.accountId);
    if (viewed) {
      return {
        ok: true,
        context: {
          acting: viewed.account,
          memberships: lookup.accounts,
          impersonation: viewed.expiresAtIso
            ? {
                displayName: viewed.account.displayName,
                expiresAtIso: viewed.expiresAtIso,
                sessionId: browserChoice.viewSessionId,
              }
            : null,
          needsRestore: false,
        },
      };
    }
  }

  const choice = chooseActingAccount({
    accounts: lookup.accounts,
    browserAccountId: browserChoice?.accountId ?? null,
    orgModuleEnabled: await deps.orgModuleEnabled(),
  });
  if (!choice) return { ok: false, reason: "server_error" };
  return {
    ok: true,
    context: {
      acting: choice.acting,
      memberships: lookup.accounts,
      impersonation: null,
      // A staff view-as cookie is never "restored" over; the staff tools end it.
      needsRestore: choice.needsRestore && !browserChoice?.viewSessionId,
    },
  };
}
