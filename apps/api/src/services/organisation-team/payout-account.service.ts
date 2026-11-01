import { entityActorCan, payoutBankAccountSummary } from "@auction/domain";
import type { ILegalEntityConnectReader } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  IPayoutAccountService,
  IPayoutBankAccountProvider,
  PayoutAccountView,
} from "../interfaces/organisation-profile-service.js";
import type { OrganisationTeamError } from "../interfaces/organisation-team-service.js";

const FORBIDDEN: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners, admins and finance can see where the organisation is paid.",
};

/**
 * The bank account the organisation's payouts go to, as a summary: the bank, the last four
 * digits, the holder, the currency and whether it can be paid into. The provider is asked each
 * time, so a change made in its onboarding shows at once; when it cannot be asked the page says
 * so instead of failing.
 */
export class PayoutAccountService implements IPayoutAccountService {
  constructor(
    private readonly deps: {
      connect: Pick<ILegalEntityConnectReader, "findLegalEntityRowById">;
      provider: IPayoutBankAccountProvider;
      onProviderError?: (error: unknown, legalEntityId: string) => void;
    },
  ) {}

  async view(
    actor: OrganisationMemberActor,
  ): Promise<Result<PayoutAccountView, OrganisationTeamError>> {
    if (!entityActorCan(actor, "entity.payouts.read")) return err(FORBIDDEN);
    const row = await this.deps.connect.findLegalEntityRowById(actor.legalEntityId);
    const connectedAccountId = row?.stripeConnectAccountId;
    if (!connectedAccountId) return ok({ state: "not_set_up", account: null });
    try {
      const account = await this.deps.provider.defaultBankAccount(connectedAccountId);
      return ok(
        account
          ? { state: "ready", account: payoutBankAccountSummary(account) }
          : { state: "none", account: null },
      );
    } catch (error) {
      this.deps.onProviderError?.(error, actor.legalEntityId);
      return ok({ state: "unavailable", account: null });
    }
  }
}
