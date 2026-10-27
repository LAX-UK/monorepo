/**
 * A one-time line telling the person Bid changed their account for them: a link opened another
 * account's record, or they lost access to the organisation they used last. The hop that made the
 * change leaves it in a short-lived cookie; the next page shows it once and clears it.
 */
export const ACCOUNT_NOTICE_COOKIE = "lax_account_notice";

/** Long enough to survive the redirect, short enough never to surface on a later visit. */
export const ACCOUNT_NOTICE_MAX_AGE_SEC = 60;

export type AccountNotice =
  /** Switched to `accountId` to show a record that belongs to it. */
  | { kind: "switched"; accountId: string }
  /** The organisation the person used last no longer has them as a member. */
  | { kind: "removed"; organisationName: string };

export function encodeAccountNotice(notice: AccountNotice): string {
  return encodeURIComponent(JSON.stringify(notice));
}

export function decodeAccountNotice(raw: string | null | undefined): AccountNotice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Record<string, unknown>>;
    if (value.kind === "switched" && typeof value.accountId === "string") {
      return { kind: "switched", accountId: value.accountId };
    }
    if (value.kind === "removed" && typeof value.organisationName === "string") {
      return { kind: "removed", organisationName: value.organisationName.slice(0, 120) };
    }
  } catch {
    /* a malformed cookie shows nothing */
  }
  return null;
}

/** What the notice says, or `null` when there is nothing worth saying. */
export function accountNoticeMessage(
  notice: AccountNotice | null,
  accountName: (accountId: string) => string | null,
): string | null {
  if (!notice) return null;
  if (notice.kind === "removed") {
    return `You're no longer a member of ${notice.organisationName}, so Bid opened your personal account.`;
  }
  const name = accountName(notice.accountId);
  return name ? `Switched to ${name} to show this.` : null;
}
