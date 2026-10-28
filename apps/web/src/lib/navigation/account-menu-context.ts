import type { AccountOption } from "./account-switcher-model";
import type { ClientAttention } from "./client-attention";
import type { ClientNavScope } from "./client-nav-model";

/** What the account menu needs to know about the signed-in person beyond their session. */
export type AccountMenuContext = {
  hasConsigned: boolean;
  isOrgMember: boolean;
  /** Organisation invitations waiting for an answer. */
  pendingInvitations: number;
  /** The account in use and what it holds, which decides the menu's pages. */
  scope: ClientNavScope;
  /** Every account the person can use; `null` when they have only their own. */
  accounts: AccountOption[] | null;
  /** What is waiting for them, for the header chip and the menu counts. */
  attention: ClientAttention;
};
