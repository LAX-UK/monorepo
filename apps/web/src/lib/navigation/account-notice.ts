/**
 * A one-time line telling the person their account changed without them choosing it on this
 * page: a link opened another account's record, they lost access to the organisation they used
 * last, or they switched in another tab. Whatever made the change leaves it in a short-lived
 * cookie; the next page shows it once and clears it.
 */
export const ACCOUNT_NOTICE_COOKIE = "lax_account_notice";

/** Long enough to survive the redirect, short enough never to surface on a later visit. */
export const ACCOUNT_NOTICE_MAX_AGE_SEC = 60;

export type AccountNotice =
  /** Switched to `accountId` to show a record that belongs to it. */
  | { kind: "switched"; accountId: string }
  /** Opening a notification switched to `accountId`; switching back goes to `fromAccountId`. */
  | { kind: "opened_notification"; accountId: string; fromAccountId: string }
  /** The person switched to `accountId` in another tab; this tab followed. */
  | { kind: "switched_elsewhere"; accountId: string }
  /** The organisation the person used last no longer has them as a member. */
  | { kind: "removed"; organisationName: string };

type NoticeOf<K extends AccountNotice["kind"]> = Extract<AccountNotice, { kind: K }>;

/** Names an account in a sentence ("Northbank Gallery", "your personal account"). */
type AccountName = (accountId: string) => string | null;

/** Each kind's reader and wording, in one place: a new kind is one row. */
const NOTICE_KINDS: {
  [K in AccountNotice["kind"]]: {
    decode: (value: Partial<Record<string, unknown>>) => NoticeOf<K> | null;
    message: (notice: NoticeOf<K>, accountName: AccountName) => string | null;
  };
} = {
  switched: {
    decode: (value) =>
      typeof value.accountId === "string" ? { kind: "switched", accountId: value.accountId } : null,
    message: (notice, accountName) => {
      const name = accountName(notice.accountId);
      return name ? `Switched to ${name} to show this.` : null;
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
    message: (notice, accountName) => {
      const name = accountName(notice.accountId);
      return name ? `Now acting as ${name}` : null;
    },
  },
  switched_elsewhere: {
    decode: (value) =>
      typeof value.accountId === "string"
        ? { kind: "switched_elsewhere", accountId: value.accountId }
        : null,
    message: (notice, accountName) => {
      const name = accountName(notice.accountId);
      return name ? `You switched to ${name} in another tab, so this tab shows it now.` : null;
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

/** What the notice says, or `null` when there is nothing worth saying. */
export function accountNoticeMessage(
  notice: AccountNotice | null,
  accountName: AccountName,
): string | null {
  if (!notice) return null;
  const kind = NOTICE_KINDS[notice.kind] as {
    message: (notice: AccountNotice, accountName: AccountName) => string | null;
  };
  return kind.message(notice, accountName);
}

type ToastAccount = { kind: "personal" | "organisation"; name: string; initials: string };

/** The toast after a notification opened another account: who you act as now, and the way back. */
export type NotificationSwitchToastView = {
  account: ToastAccount;
  /** "Switch back" opens the same page in the account the notification was opened from. */
  fromAccountId: string;
};

/** The toast's words, or `null` when either account is no longer one the person uses. */
export function notificationSwitchToast(
  notice: Extract<AccountNotice, { kind: "opened_notification" }>,
  accountOf: (id: string) => ToastAccount | null,
): NotificationSwitchToastView | null {
  const account = accountOf(notice.accountId);
  if (!account || !accountOf(notice.fromAccountId)) return null;
  return {
    account: {
      kind: account.kind,
      name: account.kind === "personal" ? "your personal account" : account.name,
      initials: account.initials,
    },
    fromAccountId: notice.fromAccountId,
  };
}
