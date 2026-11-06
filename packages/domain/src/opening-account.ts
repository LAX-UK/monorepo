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
   * personal account. `lostAccountId` names what they lost when the membership ended, so they can
   * be told; it is `null` while organisations are only switched off (they still belong to it).
   */
  | { kind: "fallback"; accountId: string; lostAccountId: string | null }
  /** The person has no personal account yet, so there is nothing to open. */
  | { kind: "none" };

function isUsable(account: UsableAccount, organisationsEnabled: boolean): boolean {
  return account.kind === "individual" || organisationsEnabled;
}

/**
 * Which account to try opening: what the browser asked for, when that is something the person
 * has or had a membership in, otherwise what their profile remembers.
 *
 * A browser can carry any id (a cookie left by someone else on a shared device, or one typed in
 * by hand). An id the person can use is trusted, and one they once belonged to is trusted so
 * that losing it can be explained. Any other id is ignored: it must not be named back to them,
 * and it must not overwrite what their profile remembers.
 */
export function chooseCandidate(input: {
  browserId: string | null;
  rememberedId: string | null;
  accounts: readonly UsableAccount[];
  organisationsEnabled: boolean;
  /** The person once belonged to `browserId` (the membership has since ended). */
  browserIdWasMember: boolean;
}): string | null {
  const { browserId } = input;
  if (browserId === null) return input.rememberedId;
  const usable = canUseAccount(browserId, input.accounts, input.organisationsEnabled);
  return usable || input.browserIdWasMember ? browserId : input.rememberedId;
}

export function decideOpeningAccount(input: OpeningAccountInput): OpeningAccountDecision {
  const personal = input.accounts.find((account) => account.kind === "individual");
  if (!personal) return { kind: "none" };
  if (input.candidateId === null) return { kind: "use", accountId: personal.id };

  const candidate = input.accounts.find((account) => account.id === input.candidateId);
  if (candidate && isUsable(candidate, input.organisationsEnabled)) {
    return { kind: "use", accountId: candidate.id };
  }
  return {
    kind: "fallback",
    accountId: personal.id,
    lostAccountId: candidate ? null : input.candidateId,
  };
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
