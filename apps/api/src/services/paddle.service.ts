import type { IPaddleRepository } from "@auction/persistence/interfaces";
import { isPaddleUniqueViolation } from "@auction/persistence/lib";
import type { ILotRepository } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { Counter, Histogram } from "prom-client";
import { BidError } from "../lib/errors.js";
import type { ICacheProvider } from "./interfaces/cache.js";

const PADDLE_START = 100;
const ROSTER_CACHE_TTL_SEC = 5;

export const paddleAssignmentTotal = new Counter({
  name: "paddle_assignment_total",
  help: "Paddle assignment attempts",
  labelNames: ["outcome"] as const,
});

export const paddleAssignmentConflictTotal = new Counter({
  name: "paddle_assignment_conflict_total",
  help: "Paddle number conflicts (409)",
});

export const paddleBidPlacedTotal = new Counter({
  name: "paddle_bid_placed_total",
  help: "Saleroom paddle bids placed by clerks",
  labelNames: ["outcome"] as const,
});

export const clerkBidPlacementDurationMs = new Histogram({
  name: "clerk_bid_placement_duration_ms",
  help: "Clerk paddle bid placement latency",
  buckets: [25, 50, 100, 250, 500, 1000, 2500],
});

export type PaddleServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type PaddleRosterEntry = {
  paddleNumber: number;
  userId: string;
  displayName: string;
  bidLimit: string | null;
  hasActiveSelfServiceSession: boolean;
};

export type PaddleBidResolution = {
  userId: string;
  buyerLegalEntityId: string;
  registrationId: string;
};

export class PaddleService {
  constructor(
    private readonly repo: IPaddleRepository,
    private readonly lotRepo: ILotRepository,
    private readonly cache: ICacheProvider | null,
    private readonly hasActiveSelfServiceSession?: (
      saleId: string,
      userId: string,
    ) => Promise<boolean>,
  ) {}

  private err(message: string, status: number, code?: string): Result<never, PaddleServiceError> {
    return err({ message, status, ...(code ? { code } : {}) });
  }

  async assignPaddle(input: {
    saleId: string;
    registrationId: string;
    paddleNumber?: number;
    clerkUserId: string;
  }): Promise<Result<{ paddleNumber: number }, PaddleServiceError>> {
    const reg = await this.repo.findRegistrationById(input.saleId, input.registrationId);
    if (!reg) return this.err("Registration not found", 404);
    if (reg.status !== "approved") {
      return this.err("Only approved registrations can receive a paddle", 400, "not_approved");
    }
    if (reg.kycStatus !== "approved") {
      return this.err(
        "Complete identity verification before paddle assignment",
        402,
        "kyc_required",
      );
    }

    let paddleNumber = input.paddleNumber;
    if (paddleNumber == null) {
      const preferred = reg.preferredPaddleNumber;
      if (preferred != null && (await this.repo.isPaddleFree(input.saleId, preferred))) {
        paddleNumber = preferred;
      } else {
        paddleNumber = await this.repo.nextPaddleNumber(input.saleId);
      }
    }
    if (!Number.isInteger(paddleNumber) || paddleNumber < PADDLE_START) {
      return this.err(`Paddle number must be at least ${PADDLE_START}`, 400, "invalid_paddle");
    }
    if (
      !(await this.repo.isPaddleFree(input.saleId, paddleNumber)) &&
      reg.paddleNumber !== paddleNumber
    ) {
      paddleAssignmentConflictTotal.inc();
      return this.err("Paddle number is already assigned in this sale", 409, "paddle_taken");
    }

    try {
      await this.repo.assignPaddle({
        registrationId: reg.id,
        paddleNumber,
        checkedInAt: new Date(),
      });
      await this.repo.updatePreferredPaddle(reg.userId, paddleNumber);
      await this.invalidateRosterCache(input.saleId);
      paddleAssignmentTotal.inc({ outcome: "ok" });
      console.info(
        JSON.stringify({
          action: "paddle_assigned",
          saleId: input.saleId,
          registrationId: reg.id,
          paddleNumber,
          clerkUserId: input.clerkUserId,
          outcome: "ok",
        }),
      );
      return ok({ paddleNumber });
    } catch (e) {
      if (isPaddleUniqueViolation(e)) {
        paddleAssignmentConflictTotal.inc();
        paddleAssignmentTotal.inc({ outcome: "conflict" });
        return this.err("Paddle number is already assigned in this sale", 409, "paddle_taken");
      }
      throw e;
    }
  }

  async clearPaddle(input: {
    saleId: string;
    registrationId: string;
    clerkUserId: string;
  }): Promise<Result<void, PaddleServiceError>> {
    const reg = await this.repo.findRegistrationById(input.saleId, input.registrationId);
    if (!reg) return this.err("Registration not found", 404);
    await this.repo.clearPaddle(reg.id);
    await this.invalidateRosterCache(input.saleId);
    console.info(
      JSON.stringify({
        action: "paddle_cleared",
        saleId: input.saleId,
        registrationId: reg.id,
        clerkUserId: input.clerkUserId,
        outcome: "ok",
      }),
    );
    return ok(undefined);
  }

  async listSaleRoster(saleId: string): Promise<PaddleRosterEntry[]> {
    const cacheKey = `paddle:roster:${saleId}`;
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PaddleRosterEntry[];
      }
    }
    const rows = await this.repo.listRosterForSale(saleId);
    const roster: PaddleRosterEntry[] = [];
    for (const row of rows) {
      const hasSession = this.hasActiveSelfServiceSession
        ? await this.hasActiveSelfServiceSession(saleId, row.userId)
        : false;
      roster.push({
        paddleNumber: row.paddleNumber,
        userId: row.userId,
        displayName: row.userName ?? row.userEmail ?? row.userId,
        bidLimit: row.bidLimit,
        hasActiveSelfServiceSession: hasSession,
      });
    }
    if (this.cache) {
      await this.cache.set(cacheKey, JSON.stringify(roster), ROSTER_CACHE_TTL_SEC);
    }
    return roster;
  }

  async assertPaddleAllowsBid(input: {
    saleId: string;
    paddleNumber: number;
    lotId: string;
  }): Promise<Result<PaddleBidResolution, BidError>> {
    const started = Date.now();
    const lotRow = await this.lotRepo.findById(input.lotId);
    if (!lotRow?.saleId || lotRow.saleId !== input.saleId) {
      return err(new BidError("Lot does not belong to this sale", 400));
    }

    const row = await this.repo.findBySaleAndPaddle(input.saleId, input.paddleNumber);
    if (!row) {
      return err(new BidError("Paddle not found for this sale", 404, "paddle_not_found"));
    }
    if (row.kycStatus !== "approved") {
      return err(
        new BidError("Complete identity verification before bidding", 402, "kyc_required"),
      );
    }

    clerkBidPlacementDurationMs.observe(Date.now() - started);
    return ok({
      userId: row.userId,
      buyerLegalEntityId: row.buyerLegalEntityId,
      registrationId: row.registrationId,
    });
  }

  /** Invalidate the cached paddle roster for a sale. Public so other flows
   * that mutate paddles (e.g. staff saleroom check-in) can keep it consistent. */
  async invalidateRosterCache(saleId: string): Promise<void> {
    if (this.cache) {
      await this.cache.del(`paddle:roster:${saleId}`);
    }
  }
}
