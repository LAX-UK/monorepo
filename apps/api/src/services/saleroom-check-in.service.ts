import type {
  CheckInCandidateRow,
  ISaleroomCheckInRepository,
} from "@auction/persistence/interfaces";
import { PaddleTakenError } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { Counter } from "prom-client";
import type {
  ISaleroomCheckInService,
  SaleroomCheckInServiceError,
  SaleroomCheckInSuccess,
} from "./interfaces/saleroom-check-in-service.js";
import type { PaddleService } from "./paddle.service.js";
import type { SaleroomCheckInEligibilityValidator } from "./saleroom-check-in-eligibility.validator.js";

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
    private readonly repo: ISaleroomCheckInRepository,
    private readonly eligibility: SaleroomCheckInEligibilityValidator,
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
    assignPaddle?: boolean;
    bidLimit?: number | undefined;
    paddleNumber?: number | undefined;
    laxNotes?: string | undefined;
  }): Promise<Result<SaleroomCheckInSuccess, SaleroomCheckInServiceError>> {
    const validation = await this.eligibility.validate(input);
    if (validation.isErr()) {
      const code = validation.error.code;
      if (code) saleroomCheckInTotal.inc({ outcome: code });
      return err(validation.error);
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
      result = await this.repo.checkInWithPaddle({
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        decidedByUserId: input.decidedByUserId,
        assignPaddle: input.assignPaddle !== false,
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
