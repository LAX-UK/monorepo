import {
  type ISelfServiceIdentityEligibilityGate,
  SelfServiceIdentityEligibilityError,
} from "@auction/bidding-runtime";
import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { ConditionReportRequestRow } from "../interfaces/condition-report.js";
import { createConditionReportBuyerContext } from "./condition-report-buyer-context.js";
import { ConditionReportBuyerService } from "./condition-report-buyer.service.js";

const lotId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "user-buyer-1";

function makeRequestRow(
  overrides: Partial<{
    id: string;
    status: ConditionReportRequestRow["status"];
    createdAt: Date;
  }> = {},
): ConditionReportRequestRow {
  return {
    id: overrides.id ?? "req-1",
    lotId,
    requestedByUserId: userId,
    requestingLegalEntityId: null,
    status: overrides.status ?? "pending",
    requestNote: null,
    responseNote: null,
    responseAttachmentUploadId: null,
    fulfilledByUserId: null,
    fulfilledAt: null,
    createdAt: overrides.createdAt ?? new Date("2026-01-02"),
  };
}

function buyerServiceWithRows(rows: ConditionReportRequestRow[]) {
  const requestRepo = {
    listByLotAndUser: vi.fn(async () => rows),
  } as unknown as IConditionReportRequestRepository;

  const ctx = createConditionReportBuyerContext({
    requestRepo,
    lotRepo: { findById: vi.fn() } as unknown as ILotRepository,
    legalEntityRepository: null,
    domainEventSink: null,
    identityEligibilityGate: {
      assertSelfServiceEligible: vi.fn(async () => ok(undefined)),
    },
  });

  return new ConditionReportBuyerService(ctx);
}

function buyerServiceForCreate(opts: {
  identityEligibilityGate: ISelfServiceIdentityEligibilityGate;
  lotStatus?: string;
}) {
  const requestRepo = {
    findOpenByLotAndUser: vi.fn(async () => null),
    findAnyByLotAndUser: vi.fn(async () => null),
    insert: vi.fn(async () => makeRequestRow()),
  } as unknown as IConditionReportRequestRepository;

  const ctx = createConditionReportBuyerContext({
    requestRepo,
    lotRepo: {
      findById: vi.fn(async () => ({ id: lotId, status: opts.lotStatus ?? "active" })),
    } as unknown as ILotRepository,
    legalEntityRepository: null,
    domainEventSink: null,
    identityEligibilityGate: opts.identityEligibilityGate,
  });

  return { svc: new ConditionReportBuyerService(ctx), requestRepo };
}

describe("ConditionReportBuyerService.findForBuyerOnLot", () => {
  it("returns open pending request over older fulfilled row", async () => {
    const svc = buyerServiceWithRows([
      makeRequestRow({
        id: "fulfilled-old",
        status: "fulfilled",
        createdAt: new Date("2026-01-01"),
      }),
      makeRequestRow({ id: "pending-new", status: "pending", createdAt: new Date("2026-01-03") }),
    ]);
    const row = await svc.findForBuyerOnLot({ userId, lotId });
    expect(row?.id).toBe("pending-new");
    expect(row?.status).toBe("pending");
  });

  it("returns most recent row when no open request", async () => {
    const svc = buyerServiceWithRows([
      makeRequestRow({ id: "declined-new", status: "declined", createdAt: new Date("2026-01-05") }),
      makeRequestRow({
        id: "fulfilled-old",
        status: "fulfilled",
        createdAt: new Date("2026-01-01"),
      }),
    ]);
    const row = await svc.findForBuyerOnLot({ userId, lotId });
    expect(row?.id).toBe("declined-new");
  });
});

describe("ConditionReportBuyerService.createRequest identity gate", () => {
  it("rejects unverified email before insert", async () => {
    const identityEligibilityGate: ISelfServiceIdentityEligibilityGate = {
      assertSelfServiceEligible: vi.fn(async () =>
        err(
          new SelfServiceIdentityEligibilityError(
            "Verify your email before bidding",
            403,
            "email_not_verified",
          ),
        ),
      ),
    };
    const { svc, requestRepo } = buyerServiceForCreate({ identityEligibilityGate });
    const result = await svc.createRequest({ userId, lotId });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ status: 403, code: "email_not_verified" });
    }
    expect(requestRepo.insert).not.toHaveBeenCalled();
  });

  it("rejects unapproved KYC before insert", async () => {
    const identityEligibilityGate: ISelfServiceIdentityEligibilityGate = {
      assertSelfServiceEligible: vi.fn(async () =>
        err(
          new SelfServiceIdentityEligibilityError(
            "Complete identity verification before bidding",
            402,
            "kyc_required",
          ),
        ),
      ),
    };
    const { svc, requestRepo } = buyerServiceForCreate({ identityEligibilityGate });
    const result = await svc.createRequest({ userId, lotId });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toMatchObject({ status: 402, code: "kyc_required" });
    }
    expect(requestRepo.insert).not.toHaveBeenCalled();
  });

  it("creates the request when identity is eligible", async () => {
    const identityEligibilityGate: ISelfServiceIdentityEligibilityGate = {
      assertSelfServiceEligible: vi.fn(async () => ok(undefined)),
    };
    const { svc, requestRepo } = buyerServiceForCreate({ identityEligibilityGate });
    const result = await svc.createRequest({ userId, lotId });
    expect(result.isOk()).toBe(true);
    expect(requestRepo.insert).toHaveBeenCalledOnce();
  });
});
