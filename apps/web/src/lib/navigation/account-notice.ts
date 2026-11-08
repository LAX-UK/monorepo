/**
 * A one-time line telling the person their account changed without them choosing it on this
 * page: a link opened another account's record, they lost access to the organisation they used
 * last, or they switched in another tab. Whatever made the change leaves it in a short-lived
 * cookie; the next page shows it once and clears it.
 */
export const ACCOUNT_NOTICE_COOKIE = "lax_account_notice";

/** Long enough to survive the redirect, short enough never to surface on a later visit. */
export const ACCOUNT_NOTICE_MAX_AGE_SEC = 60;

/** How long "Now acting as …" stays before it goes by itself; the person can dismiss it sooner. */
export const CHOSEN_SWITCH_SHOWN_MS = 6000;

export type AccountNotice =
  /**
   * A link opened `accountId`. `fromAccountId` is the account it was opened from, when there was
   * one: the notice then offers the way back to it. `record` is set when the link was a record
   * page's, so the notice can say the record belongs to the account.
   */
  | { kind: "switched"; accountId: string; fromAccountId?: string; record?: true }
  /** Opening a notification switched to `accountId`; switching back goes to `fromAccountId`. */
  | { kind: "opened_notification"; accountId: string; fromAccountId: string }
  /**
   * The person chose `accountId` in the switcher on the page they have just left. Only the id is
   * kept: the greeting finds the name in the server's account list, never in the cookie.
   */
  | { kind: "chose"; accountId: string }
  /** The person switched to `accountId` in another tab; this tab followed. */
  | { kind: "switched_elsewhere"; accountId: string }
  /** The organisation the person used last no longer has them as a member. */
  | { kind: "removed"; organisationName: string };

type NoticeOf<K extends AccountNotice["kind"]> = Extract<AccountNotice, { kind: K }>;

/** What a sentence needs to know about an account. */
export type AccountRef = { kind: "personal" | "organisation"; name: string };

/** Finds an account by id; `null` when the person no longer uses it. */
export type AccountLookup = (accountId: string) => AccountRef | null;

/** Names an account in a sentence: "Northbank Gallery", "your personal account". */
function accountPhrase(account: AccountRef): string {
  return account.kind === "personal" ? "your personal account" : account.name;
}

/** Each kind's reader and wording, in one place: a new kind is one row. */
const NOTICE_KINDS: {
  [K in AccountNotice["kind"]]: {
    decode: (value: Partial<Record<string, unknown>>) => NoticeOf<K> | null;
    message: (notice: NoticeOf<K>, accountOf: AccountLookup) => string | null;
    /** A second line under the message, for the kinds that have one. */
    detail?: (notice: NoticeOf<K>, accountOf: AccountLookup) => string | null;
  };
} = {
  switched: {
    decode: (value) =>
      typeof value.accountId === "string"
        ? {
            kind: "switched",
            accountId: value.accountId,
            ...(typeof value.fromAccountId === "string"
              ? { fromAccountId: value.fromAccountId }
              : {}),
            ...(value.record === true ? { record: true as const } : {}),
          }
        : null,
    message: (notice, accountOf) => {
      const account = accountOf(notice.accountId);
      if (!account) return null;
      // Only a record page's link has something to show; any other link just opened the account.
      return notice.record
        ? `Switched to ${accountPhrase(account)} to show this.`
        : `Now acting as ${accountPhrase(account)}`;
    },
  },
  chose: {
    decode: (value) =>
      typeof value.accountId === "string" ? { kind: "chose", accountId: value.accountId } : null,
    message: (notice, accountOf) => {
      const account = accountOf(notice.accountId);
      if (!account) return null;
      return account.kind === "personal"
        ? "Now using your personal account"
        : `Now acting as ${account.name}`;
    },
    detail: (notice, accountOf) => {
      const account = accountOf(notice.accountId);
      if (!account) return null;
      return account.kind === "personal"
        ? "Your own bids and purchases."
        : "Bids, purchases and consignments here are the organisation's.";
    },
  },
  opened_notification: {
    decode: (value) =>
      typeof value.accountId === "string" && typeof value.fromAccountId === "string"
        ? {
            kind: "opened_notification",
            accountId: value.accountId,
            fromAccountId: value.fromAccountId,
          }
        : null,
    message: (notice, accountOf) => {
      const account = accountOf(notice.accountId);
      return account ? `Now acting as ${accountPhrase(account)}` : null;
    },
  },
  switched_elsewhere: {
    decode: (value) =>
      typeof value.accountId === "string"
        ? { kind: "switched_elsewhere", accountId: value.accountId }
        : null,
    message: (notice, accountOf) => {
      const account = accountOf(notice.accountId);
      return account
        ? `You switched to ${accountPhrase(account)} in another tab, so this tab shows it now.`
        : null;
    },
  },
  removed: {
    decode: (value) =>
      typeof value.organisationName === "string"
        ? { kind: "removed", organisationName: value.organisationName.slice(0, 120) }
        : null,
    message: (notice) =>
      `You're no longer a member of ${notice.organisationName}, so Bid opened your personal account.`,
  },
};

function isNoticeKind(kind: unknown): kind is AccountNotice["kind"] {
  return typeof kind === "string" && Object.hasOwn(NOTICE_KINDS, kind);
}

export function encodeAccountNotice(notice: AccountNotice): string {
  return encodeURIComponent(JSON.stringify(notice));
}

export function decodeAccountNotice(raw: string | null | undefined): AccountNotice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Record<string, unknown>>;
    if (!isNoticeKind(value.kind)) return null;
    return NOTICE_KINDS[value.kind].decode(value);
  } catch {
    /* a malformed cookie shows nothing */
    return null;
  }
}

type KindReader = {
  message: (notice: AccountNotice, accountOf: AccountLookup) => string | null;
  detail?: (notice: AccountNotice, accountOf: AccountLookup) => string | null;
};

/** What the notice says, or `null` when there is nothing worth saying. */
export function accountNoticeMessage(
  notice: AccountNotice | null,
  accountOf: AccountLookup,
): string | null {
  if (!notice) return null;
  return (NOTICE_KINDS[notice.kind] as KindReader).message(notice, accountOf);
}

/** The line under the message, for the kinds that explain what changed. */
export function accountNoticeDetail(
  notice: AccountNotice | null,
  accountOf: AccountLookup,
): string | null {
  if (!notice) return null;
  return (NOTICE_KINDS[notice.kind] as KindReader).detail?.(notice, accountOf) ?? null;
}

/**
 * Whether a notice is still true of the account in use. A notice left for another account (a
 * stale cookie, a second tab) says nothing about this page and is not shown.
 */
export function noticeBelongsToAccount(notice: AccountNotice | null, actingId: string): boolean {
  if (!notice) return false;
  return notice.kind === "removed" || notice.accountId === actingId;
}

type ToastAccount = { kind: "personal" | "organisation"; name: string; initials: string };

/** The toast after a notification opened another account: who you act as now, and the way back. */
export type NotificationSwitchToastView = {
  account: ToastAccount;
  /** The kind of account "Switch back" goes to, which decides the page it opens. */
  fromKind: ToastAccount["kind"];
  /** "Switch back" opens the same page in the account the notification was opened from. */
  fromAccountId: string;
};

/** The toast's words, or `null` when either account is no longer one the person uses. */
export function notificationSwitchToast(
  notice: Extract<AccountNotice, { kind: "opened_notification" }>,
  accountOf: (id: string) => ToastAccount | null,
): NotificationSwitchToastView | null {
  const account = accountOf(notice.accountId);
  const from = accountOf(notice.fromAccountId);
  if (!account || !from) return null;
  return {
    fromKind: from.kind,
    account: {
      kind: account.kind,
      name: account.kind === "personal" ? "your personal account" : account.name,
      initials: account.initials,
    },
    fromAccountId: notice.fromAccountId,
  };
}
