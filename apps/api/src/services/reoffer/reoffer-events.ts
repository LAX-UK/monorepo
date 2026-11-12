import type { ReofferActor } from "@auction/domain";
import type { LotReofferView } from "@auction/persistence/interfaces";

/** What every re-offer event says about its offer. Ids and amounts only: no names or emails. */
export function reofferEventBase(
  offer: Pick<LotReofferView, "id" | "buyerDefaultId" | "sequence" | "amountPence">,
  actor: ReofferActor,
) {
  return {
    reofferId: offer.id,
    buyerDefaultId: offer.buyerDefaultId,
    sequence: offer.sequence,
    actor,
    amountPence: offer.amountPence,
  };
}
