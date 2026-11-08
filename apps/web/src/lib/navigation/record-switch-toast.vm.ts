import type { AccountNotice } from "./account-notice";
import type { AccountOption } from "./account-switcher-model";

type ToastAccount = Pick<AccountOption, "kind" | "name" | "initials">;

/** The toast after a link opened another account (a record's owner, an invitation, an email). */
export type RecordSwitchToastView = {
  /** The account now in use, for the toast's tile. */
  account: Pick<AccountOption, "kind" | "initials">;
  /** "Opened in Northbank Gallery", "Opened in your personal account". */
  title: string;
  /** "This record belongs to the organisation." Only for a record page's link. */
  detail?: string;
  /** "Back to Personal", "Back to Northbank Gallery". */
  backLabel: string;
  /** The kind of account the way back goes to, which decides the page it opens. */
  fromKind: AccountOption["kind"];
  fromAccountId: string;
};

function phrase(account: ToastAccount): string {
  return account.kind === "personal" ? "your personal account" : account.name;
}

function recordDetail(account: ToastAccount): string {
  return account.kind === "personal"
    ? "This record belongs to your personal account."
    : "This record belongs to the organisation.";
}

/**
 * The toast for a link that switched accounts, or `null` when the notice has no account to go
 * back to or either account is no longer one the person uses (the plain notice then says what
 * happened). The sentence about the record is only for a record page's link: an email link, an
 * invitation or the All accounts list opened the account without any record to explain.
 */
export function recordSwitchToast(
  notice: Extract<AccountNotice, { kind: "switched" }>,
  accountOf: (id: string) => ToastAccount | null,
): RecordSwitchToastView | null {
  if (!notice.fromAccountId) return null;
  const account = accountOf(notice.accountId);
  const from = accountOf(notice.fromAccountId);
  if (!account || !from) return null;
  return {
    account,
    title: `Opened in ${phrase(account)}`,
    ...(notice.record ? { detail: recordDetail(account) } : {}),
    backLabel: `Back to ${from.kind === "personal" ? "Personal" : from.name}`,
    fromKind: from.kind,
    fromAccountId: notice.fromAccountId,
  };
}
