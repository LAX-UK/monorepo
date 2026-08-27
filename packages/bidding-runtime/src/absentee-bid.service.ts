import { buyerEntityCanBid } from "@auction/domain";
import type { IAbsenteeBidRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IBidIdentityEligibilityGate } from "./bid/identity-bid-eligibility.gate.js";
import type { AbsenteeBidServiceError, IAbsenteeBidService, IBidPlacer } from "./ports.js";

export const ABSENTEE_EXECUTING_LEASE_MS = 15 * 60 * 1000;

function minIncrementAmount(lot: Lot): number {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

export function absenteePlacementKey(absenteeBidId: string): string {
  return `absentee:${absenteeBidId}`;
}

export class AbsenteeBidService implements IAbsenteeBidService {
  constructor(
    private readonly absenteeBidRepo: IAbsenteeBidRepository,
    private readonly bidPlacer: IBidPlacer,
    private readonly lotRepo: ILotRepository,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly bidRepo: IBidRepository | null = null,
    private readonly identityEligibilityGate: IBidIdentityEligibilityGate | null = null,
  ) {}

  private async reconcileStaleExecutingLeases(cutoff: Date): Promise<void> {
    if (!this.bidRepo) {
      await this.absenteeBidRepo.expireStaleExecutingLeases(cutoff);
      return;
    }
    const stale = await this.absenteeBidRepo.listStaleExecuting(cutoff);
    for (const row of stale) {
      const existing = await this.bidRepo.findByInternalPlacementKey(absenteePlacementKey(row.id));
      if (existing) {
        await this.absenteeBidRepo.markExecuted(row.id, existing.id);
      } else {
        await this.absenteeBidRepo.markLost(row.id, "executing_lease_expired");
      }
    }
  }

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
    if (!this.identityEligibilityGate) {
      return err({
        message: "Identity eligibility gate is not configured",
        status: 503,
        code: "identity_gate_unconfigured",
      });
    }
    const identityResult = await this.identityEligibilityGate.assertSelfServiceEligible(
      input.userId,
    );
    if (identityResult.isErr()) {
      return err({
        message: identityResult.error.message,
        status: identityResult.error.status,
        ...(identityResult.error.code ? { code: identityResult.error.code } : {}),
      });
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
        return err({
          message: "Not a member of the selected legal entity",
          status: 403,
          code: "membership_required",
        });
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

  async expireStaleExecutingLeases(): Promise<void> {
    const cutoff = new Date(Date.now() - ABSENTEE_EXECUTING_LEASE_MS);
    await this.reconcileStaleExecutingLeases(cutoff);
  }

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
      const placementKey = absenteePlacementKey(row.id);
      const claimed = await this.absenteeBidRepo.claimExecuting(row.id, now);
      if (!claimed) {
        if (this.bidRepo) {
          const existing = await this.bidRepo.findByInternalPlacementKey(placementKey);
          if (existing) {
            await this.absenteeBidRepo.markExecuted(row.id, existing.id);
          }
        }
        continue;
      }

      const res = await this.bidPlacer.placeBid({
        placedByUserId: row.userId,
        buyerLegalEntityId: row.buyerLegalEntityId,
        lotId,
        amount: bidAmount,
        maxAutoBidAmount: max,
        placement: { placedVia: "absentee" },
        internalPlacementKey: placementKey,
      });

      if (res.isOk()) {
        await this.absenteeBidRepo.markExecuted(row.id, res.value.id);
      } else if (this.bidRepo) {
        const existing = await this.bidRepo.findByInternalPlacementKey(placementKey);
        if (existing) {
          await this.absenteeBidRepo.markExecuted(row.id, existing.id);
        } else {
          await this.absenteeBidRepo.markLost(row.id, res.error.code ?? res.error.message);
        }
      } else {
        await this.absenteeBidRepo.markLost(row.id, res.error.code ?? res.error.message);
      }
    }
  }
}
