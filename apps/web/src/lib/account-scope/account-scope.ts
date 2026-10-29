import type { EntityActor } from "@auction/domain";

/**
 * The account whose pages are being read: the person's own, or an organisation they act for with
 * their role in it. Buying pages, Home and the menu counts read this account's records and never
 * the person's own records while they act for an organisation.
 */
export type ScopedAccount =
  | { kind: "personal" }
  | {
      kind: "organisation";
      id: string;
      name: string;
      /** The member's role, and whether support staff are viewing as the client. */
      actor: EntityActor;
    };

export type AccountScope = {
  account: ScopedAccount;
  /** The signed-in person. */
  actor: { userId: string };
};

/** Resolves the account in use for this request. One port, so every reader agrees on it. */
export interface IAccountScope {
  current(): Promise<AccountScope>;
}

/** The organisation in use, or `null` for the person's own account. */
export function organisationOf(
  scope: AccountScope,
): Extract<ScopedAccount, { kind: "organisation" }> | null {
  return scope.account.kind === "organisation" ? scope.account : null;
}
