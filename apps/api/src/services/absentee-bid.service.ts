import type { Database } from "@auction/db";
import { absenteeBid } from "@auction/db/schema";
import { buyerEntityCanBid } from "@auction/domain";
import type { Lot } from "@auction/types";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import type {
  AbsenteeBidServiceError,
  IAbsenteeBidService,
} from "./interfaces/absentee-bid-service.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IBidPlacer } from "./interfaces/place-bid.js";
import type { ILotRepository } from "./interfaces/repositories.js";

export type { AbsenteeBidServiceError } from "./interfaces/absentee-bid-service.js";

/** If a row stays `executing` longer than this after a crash, it is marked lost (no double bid on retry). */
const ABSENTEE_EXECUTING_LEASE_MS = 15 * 60 * 1000;

function minIncrementAmount(lot: Lot): number {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

/** Postgres `unique_violation` SQLSTATE. Used to distinguish "scheduled twice" from infra errors. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

export class AbsenteeBidService implements IAbsenteeBidService {
  constructor(
    private readonly db: Database,
    private readonly bidService: IBidPlacer,
    private readonly lotRepo: ILotRepository,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly bidEligibility: IBidEligibility | null = null,
  ) {}

  async schedule(input: {
    userId: string;
    lotId: string;
    buyerLegalEntityId: string;
    maxAmount: number;
  }): Promise<Result<{ id: string }, AbsenteeBidServiceError>> {
    const lotRow = await this.lotRepo.findById(input.lotId);
    if (!lotRow) {
      return err({ message: "Lot not found", status: 404 });
    }
    if (lotRow.status !== "scheduled" && lotRow.status !== "active") {
      return err({
        message: "Absentee bids are only allowed on scheduled or live lots",
        status: 400,
      });
    }
    if (this.bidEligibility) {
      const eligibility = await this.bidEligibility.assertCanPlaceBid({
        placedByUserId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        lotId: input.lotId,
        amount: input.maxAmount,
        maxAutoBidAmount: input.maxAmount,
        placedVia: "absentee",
      });
      if (eligibility.isErr()) {
        return err({
          message: eligibility.error.message,
          status: eligibility.error.status,
          ...(eligibility.error.code ? { code: eligibility.error.code } : {}),
        });
      }
    }
    if (this.legalEntityRepository) {
      const entity = await this.legalEntityRepository.findById(input.buyerLegalEntityId);
      if (!entity) {
        return err({ message: "Buyer legal entity not found", status: 404 });
      }
      if (!buyerEntityCanBid(entity.status)) {
        return err({
          message: "Buyer legal entity is not authorised to bid",
          status: 403,
          code: "entity_not_authorised_to_bid",
        });
      }
      const mem = await this.legalEntityRepository.findActiveMembership(
        input.userId,
        input.buyerLegalEntityId,
      );
      if (!mem) {
        return err({ message: "Not a member of the selected legal entity", status: 403 });
      }
    }

    try {
      const [row] = await this.db
        .insert(absenteeBid)
        .values({
          lotId: input.lotId,
          userId: input.userId,
          buyerLegalEntityId: input.buyerLegalEntityId,
          maxAmount: input.maxAmount.toFixed(2),
          status: "scheduled",
        })
        .returning({ id: absenteeBid.id });
      if (!row) {
        return err({
          message: "Could not schedule absentee bid",
          status: 500,
          code: "absentee_insert_failed",
        });
      }
      return ok({ id: row.id });
    } catch (e) {
      if (isUniqueViolation(e)) {
        return err({
          message: "An absentee bid is already scheduled for this lot",
          status: 409,
          code: "absentee_duplicate",
        });
      }
      return err({
        message: "Could not schedule absentee bid",
        status: 500,
        code: "absentee_insert_failed",
      });
    }
  }

  /**
   * Marks `executing` absentee rows whose lease expired (or pre-migration rows with null lease
   * timestamp). Safe to call from a periodic job; also invoked at the start of replay.
   */
  async expireStaleExecutingLeases(): Promise<void> {
    const cutoff = new Date(Date.now() - ABSENTEE_EXECUTING_LEASE_MS);
    await this.db
      .update(absenteeBid)
      .set({
        status: "lost",
        cancellationReason: "executing_lease_expired",
        executingAt: null,
      })
      .where(
        and(
          eq(absenteeBid.status, "executing"),
          or(isNull(absenteeBid.executingAt), lt(absenteeBid.executingAt, cutoff)),
        ),
      );
  }

  /** When a lot becomes live, execute scheduled absentee rows against the opening price. */
  async replayScheduledForLot(lotId: string): Promise<void> {
    await this.expireStaleExecutingLeases();

    const rows = await this.db
      .select()
      .from(absenteeBid)
      .where(and(eq(absenteeBid.lotId, lotId), eq(absenteeBid.status, "scheduled")))
      .orderBy(desc(absenteeBid.maxAmount));

    let lotRow = await this.lotRepo.findById(lotId);
    if (!lotRow || lotRow.status !== "active") return;

    for (const row of rows) {
      const max = Number.parseFloat(String(row.maxAmount));
      if (!Number.isFinite(max)) {
        await this.db
          .update(absenteeBid)
          .set({ status: "voided", cancellationReason: "invalid_max" })
          .where(eq(absenteeBid.id, row.id));
        continue;
      }

      lotRow = await this.lotRepo.findById(lotId);
      if (!lotRow || lotRow.status !== "active") break;

      const cur = Number.parseFloat(lotRow.currentPrice);
      const inc = minIncrementAmount(lotRow);
      const bidAmount = cur + inc;
      if (bidAmount > max + 1e-9) {
        await this.db.update(absenteeBid).set({ status: "lost" }).where(eq(absenteeBid.id, row.id));
        continue;
      }

      const now = new Date();
      const [claimed] = await this.db
        .update(absenteeBid)
        .set({ status: "executing", executingAt: now })
        .where(and(eq(absenteeBid.id, row.id), eq(absenteeBid.status, "scheduled")))
        .returning({ id: absenteeBid.id });
      if (!claimed) {
        continue;
      }

      const res = await this.bidService.placeBid({
        placedByUserId: row.userId,
        buyerLegalEntityId: row.buyerLegalEntityId,
        lotId,
        amount: bidAmount,
        maxAutoBidAmount: max,
        placement: { placedVia: "absentee" },
      });

      if (res.isOk()) {
        await this.db
          .update(absenteeBid)
          .set({
            status: "executed",
            executedBidId: res.value.id,
            executingAt: null,
          })
          .where(eq(absenteeBid.id, row.id));
      } else {
        await this.db
          .update(absenteeBid)
          .set({
            status: "lost",
            cancellationReason: res.error.code ?? res.error.message,
            executingAt: null,
          })
          .where(eq(absenteeBid.id, row.id));
      }
    }
  }
}
