import {
  buyerEntityCanBid,
  isBiddingClosedStatus,
  organisationBidRefusalMessage,
} from "@auction/domain";
import type { IAbsenteeBidRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole, Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { bidAuthorityError } from "./bid/bid-authority-error.js";
import type { IBidAuthority } from "./bid/bid-authority.service.js";
import { type IBiddingLimitGate, PerLotBiddingLimitGate } from "./bid/bidding-limit.gate.js";
import type { IBidIdentityEligibilityGate } from "./bid/identity-bid-eligibility.gate.js";
import type { SaleRegistrationBidGate } from "./bid/sale-registration-bid.gate.js";
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
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly bidRepo: IBidRepository | null,
    private readonly identityEligibilityGate: IBidIdentityEligibilityGate | null,
    private readonly bidAuthority: IBidAuthority,
    private readonly biddingLimitGate: IBiddingLimitGate = new PerLotBiddingLimitGate(),
    /** When set, a maximum on a lot in a sale needs the sale registration a live bid needs. */
    private readonly saleRegistrationGate: Pick<
      SaleRegistrationBidGate,
      "assertCanBid"
    > | null = null,
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
    /** The acting member's role on the account; decides whether the sale needs a registration. */
    memberRole?: LegalEntityMemberRole | undefined;
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
        ...(isBiddingClosedStatus(lotRow.status) ? { code: "lot_closed" } : {}),
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
    const entity = await this.legalEntityRepository.findById(input.buyerLegalEntityId);
    if (!entity) {
      return err({ message: "Buyer legal entity not found", status: 404 });
    }
    if (!buyerEntityCanBid(entity.status)) {
      return err({
        message:
          organisationBidRefusalMessage(entity.status) ??
          "Buyer legal entity is not authorised to bid",
        status: 403,
        code: "entity_not_authorised_to_bid",
      });
    }
    const authority = await this.bidAuthority.resolve({
      userId: input.userId,
      legalEntityId: input.buyerLegalEntityId,
      saleId: lotRow.saleId ?? null,
    });
    if (!authority.allowed) {
      const { message, status, code } = bidAuthorityError(authority.reason);
      return err({ message, status, ...(code ? { code } : {}) });
    }
    if (this.saleRegistrationGate && lotRow.saleId) {
      const registration = await this.saleRegistrationGate.assertCanBid({
        saleId: lotRow.saleId,
        placedByUserId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        memberRole: input.memberRole,
        effectiveAmount: input.maxAmount,
        operatorBypass: false,
      });
      if (registration.isErr()) {
        const { message, status, code, details } = registration.error;
        return err({ message, status, ...(code ? { code } : {}), ...(details ? { details } : {}) });
      }
    }
    const limits = await this.biddingLimitGate.check({
      legalEntityId: input.buyerLegalEntityId,
      placedByUserId: input.userId,
      lotId: input.lotId,
      saleId: lotRow.saleId ?? null,
      amount: input.maxAmount,
      authority,
    });
    if (limits.isErr()) {
      const { message, status, code, details } = limits.error;
      return err({ message, status, ...(code ? { code } : {}), ...(details ? { details } : {}) });
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
