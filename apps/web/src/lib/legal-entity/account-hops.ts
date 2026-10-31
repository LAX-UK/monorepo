import { accountsUnavailableHref, switchAccountHref } from "@/lib/navigation/account-link";
import type { AccountNotice } from "@/lib/navigation/account-notice";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { type UsableAccount, canUseAccount } from "@auction/domain";

/**
 * What a hop does: where it sends the browser, and, when the account changes, the account to
 * write, whether to remember it on the profile, and the one-time notice to show. Pure, so the
 * route handlers only carry it out.
 */
export type HopPlan = {
  redirect: string;
  switchTo?: { accountId: string; remember: boolean; notice?: AccountNotice };
};

export function noAccessHref(next: string): string {
  return `${CLIENT_ROUTES.noAccess}?${new URLSearchParams({ next }).toString()}`;
}

/** Opening `next` in `requestedId`: stay, switch with a notice, or explain there is no access. */
export function planSwitchHop(input: {
  requestedId: string | null;
  next: string;
  /** The account this browser uses now; `null` when it has no usable choice yet. */
  actingId: string | null;
  memberships: readonly UsableAccount[];
  orgModuleEnabled: boolean;
  /** A notification was opened from this account: the notice offers to switch back to it. */
  notificationFrom?: string | null;
}): HopPlan {
  const { requestedId, next } = input;
  if (!requestedId || requestedId === input.actingId) return { redirect: next };
  if (!canUseAccount(requestedId, input.memberships, input.orgModuleEnabled)) {
    return { redirect: noAccessHref(next) };
  }
  // Switching back is only offered to the account this browser really used.
  const from = input.notificationFrom;
  const notice: AccountNotice =
    from && from === input.actingId
      ? { kind: "opened_notification", accountId: requestedId, fromAccountId: from }
      : { kind: "switched", accountId: requestedId };
  return {
    redirect: next,
    switchTo: { accountId: requestedId, remember: true, notice },
  };
}

/**
 * Opening an organisation the person has just joined: its Home, remembered on their profile. No
 * notice: Home greets a new member with a welcome card that already names the organisation and
 * their role, and a second line saying the same would only repeat it.
 */
export function planJoinHop(organisationId: string): HopPlan {
  return {
    redirect: CLIENT_ROUTES.home,
    switchTo: { accountId: organisationId, remember: true },
  };
}

/**
 * Putting a browser back in the right account, as the API chose it (and corrected the profile).
 * Only an answer reaches here: when the API cannot answer, the hop shows the retry state and the
 * browser keeps what it has, rather than being moved to the personal account.
 */
export function planRestoreHop(input: {
  next: string;
  restored: {
    accountId: string;
    lostOrganisation: { displayName: string } | null;
  };
}): HopPlan {
  const { next, restored } = input;
  return {
    redirect: next,
    switchTo: {
      accountId: restored.accountId,
      remember: false,
      ...(restored.lostOrganisation
        ? {
            notice: {
              kind: "removed",
              organisationName: restored.lostOrganisation.displayName,
            },
          }
        : {}),
    },
  };
}

/** Who owns a record, as the API answered for the signed-in person. */
export type RecordOwner =
  | { kind: "ok"; legalEntityId: string }
  | { kind: "no_access" }
  | { kind: "not_found" }
  /** The API could not answer; nothing is known about the record. */
  | { kind: "unavailable" };

/**
 * Where a consignment or purchase page goes when the record belongs to another account: through
 * the switch hop to its owner, to the no-access page, or, when the owner could not be looked up,
 * to the retry state (rendering it in the current account could say "not found" about a record
 * that exists). `null` when the page should render (or report not found) as it is.
 */
export function recordHop(
  owner: RecordOwner,
  actingId: string | null,
  next: string,
): string | null {
  if (owner.kind === "unavailable") return accountsUnavailableHref(next);
  if (owner.kind === "no_access") return noAccessHref(next);
  if (owner.kind === "ok" && owner.legalEntityId !== actingId) {
    return switchAccountHref(owner.legalEntityId, next);
  }
  return null;
}
