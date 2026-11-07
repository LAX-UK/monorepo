import { accountPurchaseScope, pickRefusal } from "@auction/domain";
import type { BankTransferInstructions } from "@auction/types";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IPayTransferService,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { IPaymentGroupGateway } from "../payment-group/payment-group-ports.js";
import type { PayProgressResolver } from "./pay-progress.resolver.js";
import type { PurchaseCandidateReader } from "./purchase-candidate.reader.js";
import { buyingError, entityActorOf, memberIsPayer } from "./purchase-view.js";

export type PayTransferDeps = {
  candidates: Pick<PurchaseCandidateReader, "read">;
  progress: Pick<PayProgressResolver, "resolve">;
  gateway: Pick<IPaymentGroupGateway, "bankTransferInstructions">;
};

/**
 * The account details and reference for a bank transfer already chosen for these lots. Only a
 * member who pays for the account sees them, only for lots that are this account's own purchases,
 * and only while the transfer is waiting for its money. Anything else, and any failure to ask the
 * provider, answers `null`: the page then points the payer to the email they were sent.
 */
export class PayTransferService implements IPayTransferService {
  constructor(private readonly deps: PayTransferDeps) {}

  async instructions(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<{ instructions: BankTransferInstructions | null }> {
    const refusal = pickRefusal(lotIds);
    if (refusal) return err(buyingError(refusal));
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope || !memberIsPayer(actor)) return err(buyingError("insufficient_entity_role"));

    const { entries } = await this.deps.candidates.read(actor, scope === "own", lotIds);
    const lots = entries.map((e) => ({ lotId: e.lotId, group: e.flags.group }));
    const progress = await this.deps.progress.resolve(lots);
    const transfer = lots.find(
      ({ group }) =>
        group?.checkoutRail === "gb_bank_transfer" &&
        group.stripeCheckoutSessionId !== null &&
        progress.get(group.id)?.rail === "bank_transfer",
    )?.group;
    if (!transfer?.stripeCheckoutSessionId) return ok({ instructions: null });
    try {
      return ok({
        instructions: await this.deps.gateway.bankTransferInstructions(
          transfer.stripeCheckoutSessionId,
        ),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "pay_transfer_instructions_unreadable",
          paymentGroupId: transfer.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return ok({ instructions: null });
    }
  }
}
