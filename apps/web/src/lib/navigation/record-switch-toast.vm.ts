import type { AccountNotice } from "./account-notice";
import type { AccountOption } from "./account-switcher-model";

type ToastAccount = Pick<AccountOption, "kind" | "name" | "initials">;

/** The toast after a record link opened the account that owns the record. */
export type RecordSwitchToastView = {
  /** The account now in use, for the toast's tile. */
  account: Pick<AccountOption, "kind" | "initials">;
  /** "Opened in Northbank Gallery", "Opened in your personal account". */
  title: string;
  /** "This record belongs to the organisation." */
  detail: string;
  /** "Back to Personal", "Back to Northbank Gallery". */
  backLabel: string;
  /** The kind of account the way back goes to, which decides the page it opens. */
  fromKind: AccountOption["kind"];
  fromAccountId: string;
};

function phrase(account: ToastAccount): string {
  return account.kind === "personal" ? "your personal account" : account.name;
}

/**
 * The toast for a record link that switched accounts, or `null` when the notice has no account
 * to go back to or either account is no longer one the person uses (the plain notice then says
 * what happened).
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
    detail:
      account.kind === "personal"
        ? "This record belongs to your personal account."
        : "This record belongs to the organisation.",
    backLabel: `Back to ${from.kind === "personal" ? "Personal" : from.name}`,
    fromKind: from.kind,
    fromAccountId: notice.fromAccountId,
  };
}
