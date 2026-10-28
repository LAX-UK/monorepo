import { absenteeBid, bid, lot } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, max, ne, or } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type {
  IMemberBidInstructionsRepository,
  StandingBidInstruction,
} from "../interfaces/member-bid-instructions.repository.js";

const PROXY_CEILING = or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true));
/** Lots that are finished can never bid again; reading them would only add noise. */
const OPEN_LOT_STATUSES = ["draft", "scheduled", "active"] as const;

/**
 * A member's auto-bid ceilings and absentee bids for one organisation. Which of them stop on
 * removal is decided by the domain (`stopsOnRemoval`); this only reads and writes rows.
 */
export class DrizzleMemberBidInstructionsRepository implements IMemberBidInstructionsRepository {
  async listForMember(
    tx: DbTransaction,
    legalEntityId: string,
    memberUserId: string,
  ): Promise<StandingBidInstruction[]> {
    const [ceilings, absentee] = await Promise.all([
      tx
        .select({
          lotId: lot.id,
          lotTitle: lot.title,
          lotNumber: lot.lotNumber,
          lotStatus: lot.status,
          maxAmount: max(bid.maxAutoBidAmount),
        })
        .from(bid)
        .innerJoin(lot, eq(lot.id, bid.lotId))
        .where(
          and(
            eq(bid.buyerLegalEntityId, legalEntityId),
            eq(bid.bidderId, memberUserId),
            inArray(lot.status, [...OPEN_LOT_STATUSES]),
            PROXY_CEILING,
          ),
        )
        .groupBy(lot.id),
      tx
        .select({
          id: absenteeBid.id,
          status: absenteeBid.status,
          lotId: lot.id,
          lotTitle: lot.title,
          lotNumber: lot.lotNumber,
          lotStatus: lot.status,
          maxAmount: absenteeBid.maxAmount,
        })
        .from(absenteeBid)
        .innerJoin(lot, eq(lot.id, absenteeBid.lotId))
        .where(
          and(
            eq(absenteeBid.buyerLegalEntityId, legalEntityId),
            eq(absenteeBid.userId, memberUserId),
            ne(absenteeBid.status, "cancelled"),
          ),
        ),
    ]);
    return [
      ...ceilings
        .filter((row) => row.maxAmount !== null)
        .map(
          (row): StandingBidInstruction => ({
            kind: "auto_bid",
            id: row.lotId,
            lotId: row.lotId,
            lotTitle: row.lotTitle,
            lotNumber: row.lotNumber,
            lotStatus: row.lotStatus,
            instructionStatus: null,
            maxAmount: String(row.maxAmount),
          }),
        ),
      ...absentee.map(
        (row): StandingBidInstruction => ({
          kind: "absentee",
          id: row.id,
          lotId: row.lotId,
          lotTitle: row.lotTitle,
          lotNumber: row.lotNumber,
          lotStatus: row.lotStatus,
          instructionStatus: row.status,
          maxAmount: String(row.maxAmount),
        }),
      ),
    ];
  }

  async stop(
    tx: DbTransaction,
    legalEntityId: string,
    memberUserId: string,
    instruction: Pick<StandingBidInstruction, "kind" | "id" | "lotId">,
    reason: string,
  ): Promise<boolean> {
    if (instruction.kind === "absentee") {
      const rows = await tx
        .update(absenteeBid)
        .set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: reason })
        .where(
          and(
            eq(absenteeBid.id, instruction.id),
            eq(absenteeBid.buyerLegalEntityId, legalEntityId),
            eq(absenteeBid.userId, memberUserId),
            eq(absenteeBid.status, "scheduled"),
          ),
        )
        .returning({ id: absenteeBid.id });
      return rows.length > 0;
    }
    // Clears the ceiling only; the bids already placed stay in the sale.
    const rows = await tx
      .update(bid)
      .set({ maxAutoBidAmount: null, isAutoBid: false, autoBidStepAmount: null })
      .where(
        and(
          eq(bid.lotId, instruction.lotId),
          eq(bid.bidderId, memberUserId),
          eq(bid.buyerLegalEntityId, legalEntityId),
          PROXY_CEILING,
        ),
      )
      .returning({ id: bid.id });
    return rows.length > 0;
  }
}
