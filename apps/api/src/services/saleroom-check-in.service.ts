import type { Database } from "@auction/db";
import { saleNotDeleted } from "@auction/db";
import { sale, user } from "@auction/db/schema";
import { PADDLE_NUMBER_MIN, saleAllowsInRoomCheckIn } from "@auction/validators";
import { and, eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { Counter } from "prom-client";
import { buyerEntityCanBid } from "../lib/buyer-entity-bid-eligibility.js";
import { memberEligibleForStaffInRoomCheckIn } from "../lib/sale-registration-policy.js";
import {
  type CheckInCandidateRow,
  type ISaleroomCheckInRepository,
  PaddleTakenError,
} from "../repositories/drizzle-saleroom-check-in.repository.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type {
  ISaleroomCheckInService,
  SaleroomCheckInServiceError,
  SaleroomCheckInSuccess,
} from "./interfaces/saleroom-check-in-service.js";
import type { PaddleService } from "./paddle.service.js";

export const saleroomCheckInTotal = new Counter({
  name: "saleroom_check_in_total",
  help: "Staff saleroom check-in attempts",
  labelNames: ["outcome"] as const,
});

function toBidLimitString(n: number | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toFixed(2);
}

function prefixStaffNotes(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return "[staff_check_in]";
  if (trimmed.startsWith("[staff_check_in]")) return trimmed;
  return `[staff_check_in] ${trimmed}`;
}

export class SaleroomCheckInService implements ISaleroomCheckInService {
  constructor(
    private readonly db: Database,
    private readonly repo: ISaleroomCheckInRepository,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly paddleService: PaddleService,
  ) {}

  private serviceErr(
    message: string,
    status: number,
    code?: string,
  ): Result<never, SaleroomCheckInServiceError> {
    return err({ message, status, ...(code ? { code } : {}) });
  }

  async searchCandidates(input: { saleId: string; q: string }): Promise<CheckInCandidateRow[]> {
    const q = input.q.trim();
    if (q.length < 2) return [];
    return this.repo.searchCandidates(input.saleId, q, 10);
  }

  async checkInBidder(input: {
    saleId: string;
    userId: string;
    buyerLegalEntityId: string;
    decidedByUserId: string;
    bidLimit?: number | undefined;
    paddleNumber?: number | undefined;
    laxNotes?: string | undefined;
  }): Promise<Result<SaleroomCheckInSuccess, SaleroomCheckInServiceError>> {
    const [saleRow] = await this.db
      .select({ id: sale.id, status: sale.status, deliveryMode: sale.deliveryMode })
      .from(sale)
      .where(and(eq(sale.id, input.saleId), saleNotDeleted()))
      .limit(1);

    if (!saleRow) {
      return this.serviceErr("Sale not found", 404);
    }
    if (!saleAllowsInRoomCheckIn(saleRow.deliveryMode)) {
      saleroomCheckInTotal.inc({ outcome: "sale_not_saleroom" });
      return this.serviceErr(
        "Check-in is only available for onsite or hybrid sales",
        400,
        "sale_not_saleroom",
      );
    }
    if (saleRow.status !== "scheduled" && saleRow.status !== "active") {
      saleroomCheckInTotal.inc({ outcome: "sale_not_registerable" });
      return this.serviceErr("This sale is not open for check-in", 400, "sale_not_registerable");
    }

    const [userRow] = await this.db
      .select({
        id: user.id,
        emailVerified: user.emailVerified,
        kycStatus: user.kycStatus,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!userRow) {
      return this.serviceErr("User not found", 404);
    }
    if (userRow.suspendedAt != null) {
      saleroomCheckInTotal.inc({ outcome: "user_suspended" });
      return this.serviceErr("User account is suspended", 403, "user_suspended");
    }
    if (userRow.kycStatus !== "approved") {
      saleroomCheckInTotal.inc({ outcome: "kyc_required" });
      return this.serviceErr("Complete identity verification before check-in", 402, "kyc_required");
    }
    if (!userRow.emailVerified) {
      saleroomCheckInTotal.inc({ outcome: "email_not_verified" });
      return this.serviceErr("Email address must be verified", 400, "email_not_verified");
    }

    const membership = await this.legalEntityRepository.findActiveMembership(
      input.userId,
      input.buyerLegalEntityId,
    );
    if (!membership) {
      saleroomCheckInTotal.inc({ outcome: "membership_required" });
      return this.serviceErr(
        "Not a member of the selected legal entity",
        403,
        "membership_required",
      );
    }

    const entity = await this.legalEntityRepository.findById(input.buyerLegalEntityId);
    if (!entity) {
      return this.serviceErr("Legal entity not found", 404);
    }
    if (!buyerEntityCanBid(entity.status)) {
      saleroomCheckInTotal.inc({ outcome: "entity_not_authorised" });
      return this.serviceErr("Legal entity is not authorised to bid", 403, "entity_not_authorised");
    }

    if (!memberEligibleForStaffInRoomCheckIn(membership.role, entity.kind)) {
      saleroomCheckInTotal.inc({ outcome: "not_eligible_for_check_in" });
      return this.serviceErr(
        "This membership is not eligible for in-room check-in",
        400,
        "not_eligible_for_check_in",
      );
    }

    if (
      input.paddleNumber != null &&
      (!Number.isInteger(input.paddleNumber) || input.paddleNumber < PADDLE_NUMBER_MIN)
    ) {
      saleroomCheckInTotal.inc({ outcome: "invalid_paddle" });
      return this.serviceErr(
        `Paddle number must be at least ${PADDLE_NUMBER_MIN}`,
        400,
        "invalid_paddle",
      );
    }

    const bidLimitStr =
      input.bidLimit != null && Number.isFinite(input.bidLimit) && input.bidLimit > 0
        ? (toBidLimitString(input.bidLimit) ?? undefined)
        : undefined;
    const laxNotes =
      input.laxNotes != null && input.laxNotes.trim() !== ""
        ? prefixStaffNotes(input.laxNotes)
        : undefined;

    let result: Awaited<ReturnType<ISaleroomCheckInRepository["checkInWithPaddle"]>>;
    try {
      // Atomic: approved registration + paddle assignment commit together, or roll
      // back entirely on paddle conflict so staff never see a partial check-in.
      result = await this.repo.checkInWithPaddle({
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        decidedByUserId: input.decidedByUserId,
        ...(bidLimitStr !== undefined ? { bidLimit: bidLimitStr } : {}),
        ...(laxNotes !== undefined ? { laxNotes } : {}),
        requestedPaddleNumber: input.paddleNumber ?? null,
      });
    } catch (e) {
      if (e instanceof PaddleTakenError) {
        saleroomCheckInTotal.inc({ outcome: "paddle_taken" });
        return this.serviceErr(e.message, 409, e.code);
      }
      throw e;
    }

    await this.paddleService.invalidateRosterCache(input.saleId);

    saleroomCheckInTotal.inc({ outcome: "ok" });
    console.info(
      JSON.stringify({
        action: "saleroom_check_in",
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        registrationId: result.registrationId,
        paddleNumber: result.paddleNumber,
        actorUserId: input.decidedByUserId,
        outcome: "ok",
      }),
    );

    return ok({
      registrationId: result.registrationId,
      paddleNumber: result.paddleNumber,
      checkedInAt: result.checkedInAt,
      ...(bidLimitStr !== undefined ? { bidLimit: bidLimitStr } : {}),
    });
  }
}
