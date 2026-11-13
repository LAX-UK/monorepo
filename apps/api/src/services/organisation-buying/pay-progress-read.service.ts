import { accountPurchaseScope, pickRefusal } from "@auction/domain";
import type { PayPlanProgress } from "@auction/types";
import { err, ok } from "neverthrow";
import type {
  BuyingResult,
  IPayProgressReadService,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import {
  type PayProgressResolver,
  firstProgressOf,
  groupedLotsOf,
} from "./pay-progress.resolver.js";
import type { PurchaseCandidateReader } from "./purchase-candidate.reader.js";
import { buyingError, entityActorOf } from "./purchase-view.js";

export type PayProgressReadDeps = {
  candidates: Pick<PurchaseCandidateReader, "read">;
  progress: Pick<PayProgressResolver, "resolve">;
};

/**
 * Where a payment under way for the picked lots stands, and nothing else. A page that waits asks
 * this every few seconds, so it skips what the full plan works out (invoice lines, pricing, the
 * account rule and compliance checks). Same reach as the plan: the account's own purchases only.
 */
export class PayProgressReadService implements IPayProgressReadService {
  constructor(private readonly deps: PayProgressReadDeps) {}

  async progress(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<{ progress: PayPlanProgress | null }> {
    const refusal = pickRefusal(lotIds);
    if (refusal) return err(buyingError(refusal));
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return err(buyingError("insufficient_entity_role"));
    try {
      const { entries } = await this.deps.candidates.read(actor, scope === "own", lotIds);
      const byGroup = await this.deps.progress.resolve(groupedLotsOf(entries));
      return ok({ progress: firstProgressOf(entries, byGroup) });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "pay_progress_unavailable",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return err(buyingError("pay_plan_unavailable"));
    }
  }
}
