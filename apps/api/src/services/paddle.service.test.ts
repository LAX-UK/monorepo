import type { IBidAuthority } from "@auction/bidding-runtime";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../lib/errors.js";
import { fakeBidAuthority } from "../testing/fake-bid-authority.js";
import { PaddleService } from "./paddle.service.js";

function createPaddleService(
  overrides: {
    repo?: Record<string, ReturnType<typeof vi.fn>>;
    lotRepo?: Record<string, ReturnType<typeof vi.fn>>;
    cache?: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
    } | null;
    bidAuthority?: IBidAuthority;
    entityStatus?: string;
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

  const lotRepo = {
    findById: vi.fn(),
    ...overrides.lotRepo,
  };

  return new PaddleService(
    repo as never,
    lotRepo as never,
    overrides.cache ?? null,
    overrides.bidAuthority ?? fakeBidAuthority("owner"),
    {
      findById: vi.fn().mockResolvedValue({ status: overrides.entityStatus ?? "approved" }),
    } as never,
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

describe("PaddleService.assignPaddle bid authority", () => {
  const registration = {
    id: "reg-1",
    status: "approved",
    kycStatus: "approved",
    paddleNumber: null,
    preferredPaddleNumber: null,
    userId: "user-1",
    buyerLegalEntityId: "le-1",
  };

  it.each(["viewer", "finance", "consignor"] as const)(
    "refuses a paddle to a %s registered for the organisation",
    async (role) => {
      const assignPaddle = vi.fn();
      const service = createPaddleService({
        repo: {
          findRegistrationById: vi.fn().mockResolvedValue(registration),
          assignPaddle,
        },
        bidAuthority: fakeBidAuthority(role),
      });
      const result = await service.assignPaddle({
        saleId: "sale-1",
        registrationId: "reg-1",
        clerkUserId: "staff-1",
      });
      expect(result.isErr() && result.error.code).toBe("bid_role_not_permitted");
      expect(assignPaddle).not.toHaveBeenCalled();
    },
  );

  it("refuses a paddle to a buyer agent without an authorisation for the sale", async () => {
    const service = createPaddleService({
      repo: { findRegistrationById: vi.fn().mockResolvedValue(registration) },
      bidAuthority: fakeBidAuthority("buyer_agent", [{ saleId: "sale-2", bidLimit: null }]),
    });
    const result = await service.assignPaddle({
      saleId: "sale-1",
      registrationId: "reg-1",
      clerkUserId: "staff-1",
    });
    expect(result.isErr() && result.error.code).toBe("buyer_agent_authorisation_required");
  });

  it.each(["restricted", "under_review", "rejected", "archived"])(
    "refuses a paddle to a %s organisation",
    async (entityStatus) => {
      const assignPaddle = vi.fn();
      const service = createPaddleService({
        repo: { findRegistrationById: vi.fn().mockResolvedValue(registration), assignPaddle },
        entityStatus,
      });
      const result = await service.assignPaddle({
        saleId: "sale-1",
        registrationId: "reg-1",
        clerkUserId: "staff-1",
      });
      expect(result.isErr() && [result.error.status, result.error.code]).toEqual([
        403,
        "entity_not_authorised",
      ]);
      expect(assignPaddle).not.toHaveBeenCalled();
    },
  );
});

describe("PaddleService.assertPaddleAllowsBid", () => {
  it("rejects when lot does not belong to sale", async () => {
    const service = createPaddleService({
      lotRepo: {
        findById: vi.fn().mockResolvedValue({ saleId: "other-sale" }),
      },
    });
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
    const service = createPaddleService({
      lotRepo: {
        findById: vi.fn().mockResolvedValue({ saleId: "sale-1" }),
      },
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
    const service = createPaddleService({
      lotRepo: {
        findById: vi.fn().mockResolvedValue({ saleId: "sale-1" }),
      },
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
