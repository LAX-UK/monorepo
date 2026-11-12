import { offerRefusal, offerRefusalReason } from "@auction/artwork-register-contracts";
import { settlementFollowUp } from "@auction/domain";
import type { IArtworkRegisterReader } from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import type { DealRecordSettlementFollowUp } from "../interfaces/private-sale-deal-desk.js";
import type { DealLockLinks } from "./deal-lock-links.js";
import { type DealStaffViewer, canDo } from "./deal-staff-permissions.js";

export type DealSettlementFollowUpDeps = {
  register: Pick<IArtworkRegisterReader, "findById">;
  lockLinks: Pick<DealLockLinks, "attach">;
};

/**
 * Whether a settled deal's artwork is recorded sold through it, and if not, what staff need to
 * know. The rule is the domain's; this reads the register and words the register's own reason.
 * Nothing is stored: it is true while the register disagrees.
 */
export class DealSettlementFollowUpPresenter {
  constructor(private readonly deps: DealSettlementFollowUpDeps) {}

  async present(
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    settledAt: Date,
  ): Promise<DealRecordSettlementFollowUp | null> {
    if (deal.stage !== "settled" || !deal.artworkRegisterId) return null;
    const entry = await this.deps.register.findById(deal.artworkRegisterId);
    if (!entry) return null;
    const severity = settlementFollowUp(deal, {
      kind: entry.kind,
      offerState: entry.offer.state,
      offerRefKind: entry.offer.ref?.kind ?? null,
      offerRefId: entry.offer.ref?.id ?? null,
    });
    if (!severity) return null;
    const [lock] =
      severity === "urgent"
        ? await this.deps.lockLinks.attach([
            {
              entry,
              lock: offerRefusal(offerRefusalReason(entry.offer), entry.offer.state),
            },
          ])
        : [];
    return { severity, settledAt, lock: lock ?? null, canRetry: canDo(viewer, "manage") };
  }
}
