import type { IAbsenteeBidRepository } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type {
  AbsenteeBidServiceError,
  IAbsenteeBidService,
} from "./interfaces/absentee-bid-service.js";
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
    private readonly absenteeBidRepo: IAbsenteeBidRepository,
    private readonly bidService: IBidPlacer,
    private readonly lotRepo: ILotRepository,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
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
    if (this.legalEntityRepository) {
      const mem = await this.legalEntityRepository.findActiveMembership(
        input.userId,
        input.buyerLegalEntityId,
      );
      if (!mem) {
        return err({ message: "Not a member of the selected legal entity", status: 403 });
      }
    }

    try {
      const row = await this.absenteeBidRepo.insertScheduled({
        lotId: input.lotId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        maxAmount: input.maxAmount.toFixed(2),
      });
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
    await this.absenteeBidRepo.expireStaleExecutingLeases(cutoff);
  }

  /** When a lot becomes live, execute scheduled absentee rows against the opening price. */
  async replayScheduledForLot(lotId: string): Promise<void> {
    await this.expireStaleExecutingLeases();

    const rows = await this.absenteeBidRepo.listScheduledForLot(lotId);

    let lotRow = await this.lotRepo.findById(lotId);
    if (!lotRow || lotRow.status !== "active") return;

    for (const row of rows) {
      const max = Number.parseFloat(String(row.maxAmount));
      if (!Number.isFinite(max)) {
        await this.absenteeBidRepo.markVoided(row.id, "invalid_max");
        continue;
      }

      lotRow = await this.lotRepo.findById(lotId);
      if (!lotRow || lotRow.status !== "active") break;

      const cur = Number.parseFloat(lotRow.currentPrice);
      const inc = minIncrementAmount(lotRow);
      const bidAmount = cur + inc;
      if (bidAmount > max + 1e-9) {
        await this.absenteeBidRepo.markLost(row.id);
        continue;
      }

      const now = new Date();
      const claimed = await this.absenteeBidRepo.claimExecuting(row.id, now);
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
        await this.absenteeBidRepo.markExecuted(row.id, res.value.id);
      } else {
        await this.absenteeBidRepo.markLost(row.id, res.error.code ?? res.error.message);
      }
    }
  }
}
