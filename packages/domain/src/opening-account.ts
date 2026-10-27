/**
 * Which account Bid opens in for a person: the one they used last, when they may still use it,
 * otherwise their personal account. Pure, so the rule is the same wherever it is applied.
 */

/** An account the person may use Bid as today. */
export type UsableAccount = {
  id: string;
  kind: "individual" | "organisation";
};

export type OpeningAccountInput = {
  /** The account the person asked for or used last; `null` when nothing is remembered. */
  candidateId: string | null;
  /** The person's active memberships, their personal account among them. */
  accounts: readonly UsableAccount[];
  /** When organisations are switched off, only the personal account can be used. */
  organisationsEnabled: boolean;
};

export type OpeningAccountDecision =
  | { kind: "use"; accountId: string }
  /**
   * The candidate can no longer be used (membership ended, or organisations are off): open the
   * personal account and tell the person. `lostAccountId` names what they lost.
   */
  | { kind: "fallback"; accountId: string; lostAccountId: string }
  /** The person has no personal account yet, so there is nothing to open. */
  | { kind: "none" };

function isUsable(account: UsableAccount, organisationsEnabled: boolean): boolean {
  return account.kind === "individual" || organisationsEnabled;
}

export function decideOpeningAccount(input: OpeningAccountInput): OpeningAccountDecision {
  const personal = input.accounts.find((account) => account.kind === "individual");
  if (!personal) return { kind: "none" };
  if (input.candidateId === null) return { kind: "use", accountId: personal.id };

  const candidate = input.accounts.find((account) => account.id === input.candidateId);
  if (candidate && isUsable(candidate, input.organisationsEnabled)) {
    return { kind: "use", accountId: candidate.id };
  }
  return { kind: "fallback", accountId: personal.id, lostAccountId: input.candidateId };
}

/** Whether the person may use Bid as `accountId`: a member of it, and organisations are on. */
export function canUseAccount(
  accountId: string,
  accounts: readonly UsableAccount[],
  organisationsEnabled: boolean,
): boolean {
  const account = accounts.find((candidate) => candidate.id === accountId);
  return account !== undefined && isUsable(account, organisationsEnabled);
}
