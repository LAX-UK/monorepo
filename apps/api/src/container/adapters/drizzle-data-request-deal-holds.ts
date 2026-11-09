import { partyEvidenceHold } from "@auction/domain";
import type { IPartyDealRecordReader } from "@auction/persistence/interfaces";
import type {
  DataRequestDealHold,
  IDataRequestDealHolds,
} from "../../services/admin/data-requests/data-request-deal-holds.js";

/**
 * Reads the deals an account is, or was ever named as, a party to, and applies the same retention
 * rule that holds their enquiries and KYC evidence, so what staff are told is what the erasure and
 * the purge will do.
 */
export class PartyDealRetentionHolds implements IDataRequestDealHolds {
  constructor(
    private readonly deals: Pick<IPartyDealRecordReader, "forUser">,
    private readonly retentionYears: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async forAccount(subjectId: string): Promise<DataRequestDealHold[]> {
    const deals = await this.deals.forUser(subjectId);
    const hold = partyEvidenceHold(deals, this.now(), this.retentionYears);
    return hold.reasons.map((reason) => ({
      dealReference: reason.reference,
      status: reason.kind,
      heldUntil: reason.heldUntil?.toISOString() ?? null,
    }));
  }
}
