import { describe, expect, it, vi } from "vitest";
import { BidError } from "../lib/errors.js";
import { PaddleService } from "./paddle.service.js";

function createPaddleService(
  overrides: {
    repo?: Record<string, ReturnType<typeof vi.fn>>;
    db?: Record<string, unknown>;
    cache?: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
    } | null;
  } = {},
) {
  const repo = {
    findRegistrationById: vi.fn(),
    isPaddleFree: vi.fn(),
    nextPaddleNumber: vi.fn(),
    assignPaddle: vi.fn(),
    clearPaddle: vi.fn(),
    listRosterForSale: vi.fn(),
    findBySaleAndPaddle: vi.fn(),
    updatePreferredPaddle: vi.fn(),
    ...overrides.repo,
  };

  return new PaddleService(
    repo as never,
    (overrides.db ?? { select: vi.fn() }) as never,
    overrides.cache ?? null,
  );
}

describe("PaddleService.assignPaddle", () => {
  it("returns conflict when paddle is already taken", async () => {
    const service = createPaddleService({
      repo: {
        findRegistrationById: vi.fn().mockResolvedValue({
          id: "reg-1",
          status: "approved",
          kycStatus: "approved",
          paddleNumber: null,
          preferredPaddleNumber: 205,
          userId: "user-1",
        }),
        isPaddleFree: vi.fn().mockResolvedValue(false),
      },
    });

    const result = await service.assignPaddle({
      saleId: "sale-1",
      registrationId: "reg-1",
      paddleNumber: 205,
      clerkUserId: "staff-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(409);
      expect(result.error.code).toBe("paddle_taken");
    }
  });
});

describe("PaddleService.assertPaddleAllowsBid", () => {
  it("rejects when lot does not belong to sale", async () => {
    const limit = vi.fn().mockResolvedValue([{ saleId: "other-sale" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const service = createPaddleService({ db: { select } });
    const result = await service.assertPaddleAllowsBid({
      saleId: "sale-1",
      paddleNumber: 205,
      lotId: "lot-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(BidError);
      expect(result.error.status).toBe(400);
    }
  });

  it("rejects unknown paddle numbers", async () => {
    const limit = vi.fn().mockResolvedValue([{ saleId: "sale-1" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const service = createPaddleService({
      db: { select },
      repo: {
        findBySaleAndPaddle: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await service.assertPaddleAllowsBid({
      saleId: "sale-1",
      paddleNumber: 999,
      lotId: "lot-1",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe("paddle_not_found");
    }
  });

  it("resolves bidder identity for checked-in paddle", async () => {
    const limit = vi.fn().mockResolvedValue([{ saleId: "sale-1" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const service = createPaddleService({
      db: { select },
      repo: {
        findBySaleAndPaddle: vi.fn().mockResolvedValue({
          userId: "user-1",
          buyerLegalEntityId: "le-1",
          registrationId: "reg-1",
          kycStatus: "approved",
        }),
      },
    });

    const result = await service.assertPaddleAllowsBid({
      saleId: "sale-1",
      paddleNumber: 205,
      lotId: "lot-1",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        userId: "user-1",
        buyerLegalEntityId: "le-1",
        registrationId: "reg-1",
      });
    }
  });
});
