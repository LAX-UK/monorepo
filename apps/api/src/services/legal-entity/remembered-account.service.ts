import { canUseAccount, decideOpeningAccount } from "@auction/domain";
import type {
  ILegalEntityRepository,
  IRememberedAccountStore,
} from "@auction/persistence/interfaces";

export type RememberedAccountPorts = {
  accounts: Pick<ILegalEntityRepository, "listActiveMembershipsForUser" | "findById">;
  store: IRememberedAccountStore;
  /** Organisations can be switched off per environment; then only personal accounts are usable. */
  organisationsEnabled: () => boolean;
};

export type RememberOutcome = { ok: true } | { ok: false; reason: "not_a_member" };

/** The account Bid should open in, and the organisation the person lost access to, if any. */
export type RestoredAccount = {
  accountId: string;
  lostOrganisation: { id: string; displayName: string } | null;
};

/**
 * Remembers the account a person last used Bid as, on their profile, so every device opens in
 * it. Restoring checks the person may still use it; when they may not (removed from the
 * organisation, or organisations switched off) Bid opens their personal account instead, the
 * profile is corrected, and the lost organisation is named once so the page can say why.
 */
export class RememberedAccountService {
  constructor(private readonly ports: RememberedAccountPorts) {}

  async remember(userId: string, legalEntityId: string): Promise<RememberOutcome> {
    const accounts = await this.ports.accounts.listActiveMembershipsForUser(userId);
    if (!canUseAccount(legalEntityId, accounts, this.ports.organisationsEnabled())) {
      return { ok: false, reason: "not_a_member" };
    }
    await this.ports.store.remember(userId, legalEntityId);
    return { ok: true };
  }

  /**
   * @param candidateId the account this browser last used, or `null` on a new device, in which
   * case the remembered one is tried.
   */
  async restore(userId: string, candidateId: string | null): Promise<RestoredAccount | null> {
    const [accounts, remembered] = await Promise.all([
      this.ports.accounts.listActiveMembershipsForUser(userId),
      this.ports.store.findRemembered(userId),
    ]);
    const decision = decideOpeningAccount({
      candidateId: candidateId ?? remembered,
      accounts,
      organisationsEnabled: this.ports.organisationsEnabled(),
    });
    if (decision.kind === "none") return null;

    if (decision.accountId !== remembered) {
      await this.ports.store.remember(userId, decision.accountId);
    }
    if (decision.kind === "use") return { accountId: decision.accountId, lostOrganisation: null };
    return {
      accountId: decision.accountId,
      lostOrganisation: await this.lostOrganisation(decision.lostAccountId),
    };
  }

  /** Only an organisation is worth a notice; a stale id of anything else is dropped quietly. */
  private async lostOrganisation(id: string): Promise<RestoredAccount["lostOrganisation"]> {
    const entity = await this.ports.accounts.findById(id);
    if (entity?.kind !== "organisation") return null;
    return { id: entity.id, displayName: entity.displayName };
  }
}
