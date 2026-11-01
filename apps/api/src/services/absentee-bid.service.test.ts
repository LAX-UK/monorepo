import {
  BidError,
  type IBidIdentityEligibilityGate,
  SaleRegistrationBidGate,
} from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import type {
  IAbsenteeBidRepository,
  ILegalEntityRepository,
  ILotRepository,
  ISaleRegistrationBidReader,
} from "@auction/persistence/interfaces";
import { DrizzleAbsenteeBidRepository } from "@auction/persistence/repositories";
import type { Lot } from "@auction/types";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { fakeBidAuthority } from "../testing/fake-bid-authority.js";
import { AbsenteeBidService } from "./absentee-bid.service.js";
import type { IBidPlacer } from "./interfaces/place-bid.js";

function entitiesIn(status: string): ILegalEntityRepository {
  return { findById: vi.fn().mockResolvedValue({ status }) } as unknown as ILegalEntityRepository;
}

const CAT = "c1000001-0000-4000-8000-000000000001";

function okIdentityGate(): IBidIdentityEligibilityGate {
  return {
    assertSelfServiceEligible: vi.fn().mockResolvedValue(ok(undefined)),
    assertValidatedOperatorEligible: vi.fn().mockResolvedValue(ok(undefined)),
  };
}

function mkLot(overrides: Partial<Lot> = {}): Lot {
  const now = new Date();
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: null,
    sellerId: "seller-1",
    sellerLegalEntityId: "seller-le",
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: CAT,
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "10.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: new Date(now.getTime() + 86_400_000),
    status: "active",
    winnerId: null,
    voidedReason: null,
    archivedSeller: false,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

describe("AbsenteeBidService maximum before opening", () => {
  function scheduling(opts: {
    lot?: Partial<Lot>;
    registration?: { status: string; bidLimit?: string | null } | null;
  }) {
    const insertScheduled = vi.fn().mockResolvedValue({ id: "ab-1" });
    const reader = {
      findRegistration: vi.fn().mockResolvedValue(opts.registration ?? null),
    } as unknown as ISaleRegistrationBidReader;
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled", ...opts.lot })),
      } as unknown as ILotRepository,
      entitiesIn("approved"),
      null,
      okIdentityGate(),
      fakeBidAuthority("owner"),
      undefined,
      new SaleRegistrationBidGate(reader),
    );
    const schedule = (memberRole: "owner" | "buyer_agent", maxAmount = 500) =>
      svc.schedule({
        userId: "u1",
        lotId: "lot-1",
        buyerLegalEntityId: "le-1",
        memberRole,
        maxAmount,
      });
    return { schedule, insertScheduled };
  }

  it("takes a maximum on a scheduled lot from an approved agent", async () => {
    const { schedule, insertScheduled } = scheduling({ registration: { status: "approved" } });
    const result = await schedule("buyer_agent");
    expect(result.isOk()).toBe(true);
    expect(insertScheduled).toHaveBeenCalledOnce();
  });

  it("refuses an agent who has not registered for the sale", async () => {
    const { schedule, insertScheduled } = scheduling({ registration: null });
    const result = await schedule("buyer_agent");
    expect(result.isErr() && result.error.code).toBe("sale_registration_required");
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("asks an agent whose registration is pending to wait for approval", async () => {
    const { schedule, insertScheduled } = scheduling({ registration: { status: "pending" } });
    const result = await schedule("buyer_agent");
    expect(result.isErr() && result.error.code).toBe("sale_registration_pending");
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("holds a maximum to the limit approved for the sale", async () => {
    const { schedule, insertScheduled } = scheduling({
      registration: { status: "approved", bidLimit: "300.00" },
    });
    const result = await schedule("buyer_agent", 500);
    expect(result.isErr() && result.error.code).toBe("bid_limit_exceeded");
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("does not ask an owner bidding in their own name to register", async () => {
    const { schedule } = scheduling({ registration: null });
    expect((await schedule("owner")).isOk()).toBe(true);
  });

  it("answers a closed lot with the lot_closed code", async () => {
    const { schedule } = scheduling({ lot: { status: "ended" } });
    const result = await schedule("owner");
    expect(result.isErr() && result.error.code).toBe("lot_closed");
  });
});

describe("AbsenteeBidService", () => {
  it("rejects schedule when lot is not scheduled or active", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(mkLot({ status: "ended" })),
    } as unknown as ILotRepository;
    const svc = new AbsenteeBidService(
      {} as IAbsenteeBidRepository,
      {} as IBidPlacer,
      lotRepo,
      entitiesIn("approved"),
      null,
      null,
      fakeBidAuthority("owner"),
    );
    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.status).toBe(400);
  });

  it("rejects an ineligible actor before inserting an absentee bid", async () => {
    const insertScheduled = vi.fn();
    const identityEligibilityGate: IBidIdentityEligibilityGate = {
      assertSelfServiceEligible: vi
        .fn()
        .mockResolvedValue(
          err(new BidError("Verify your email before bidding", 403, "email_not_verified")),
        ),
      assertValidatedOperatorEligible: vi.fn(),
    };
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
      } as unknown as ILotRepository,
      entitiesIn("approved"),
      null,
      identityEligibilityGate,
      fakeBidAuthority("owner"),
    );

    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });

    expect(result.isErr() && [result.error.status, result.error.code]).toEqual([
      403,
      "email_not_verified",
    ]);
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("rejects a rejected buyer entity before inserting an absentee bid", async () => {
    const insertScheduled = vi.fn();
    const legalEntities = {
      findById: vi.fn().mockResolvedValue({ status: "rejected" }),
      findActiveMembership: vi.fn(),
    } as unknown as ILegalEntityRepository;
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
      } as unknown as ILotRepository,
      legalEntities,
      null,
      okIdentityGate(),
      fakeBidAuthority("owner"),
    );

    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });

    expect(result.isErr() && result.error.code).toBe("entity_not_authorised_to_bid");
    expect(legalEntities.findActiveMembership).not.toHaveBeenCalled();
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it.each([
    ["restricted", "Bidding is paused for this organisation. Contact LAX to find out why."],
    ["under_review", "Bidding opens once we've finished checking the organisation's documents."],
    ["archived", "This organisation is closed and can't bid."],
  ] as const)("refuses a %s organisation with a message that says why", async (status, message) => {
    const insertScheduled = vi.fn();
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
      } as unknown as ILotRepository,
      entitiesIn(status),
      null,
      okIdentityGate(),
      fakeBidAuthority("owner"),
    );

    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });

    expect(
      result.isErr() && [result.error.status, result.error.code, result.error.message],
    ).toEqual([403, "entity_not_authorised_to_bid", message]);
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it.each([
    [null, "membership_required"],
    ["viewer", "bid_role_not_permitted"],
    ["finance", "bid_role_not_permitted"],
    ["consignor", "bid_role_not_permitted"],
    ["buyer_agent", "buyer_agent_authorisation_required"],
  ] as const)("refuses a %s member before inserting an absentee bid", async (role, code) => {
    const insertScheduled = vi.fn();
    const legalEntities = {
      findById: vi.fn().mockResolvedValue({ status: "approved" }),
    } as unknown as ILegalEntityRepository;
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
      } as unknown as ILotRepository,
      legalEntities,
      null,
      okIdentityGate(),
      fakeBidAuthority(role),
    );

    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });

    expect(result.isErr() && result.error.code).toBe(code);
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("refuses an absentee maximum above a buyer agent's limit", async () => {
    const insertScheduled = vi.fn();
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
      } as unknown as ILotRepository,
      entitiesIn("approved"),
      null,
      okIdentityGate(),
      fakeBidAuthority("buyer_agent", [{ saleId: null, bidLimit: "400.00" }]),
    );

    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });

    expect(result.isErr() && result.error.code).toBe("bid_limit_exceeded");
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("returns 409 on duplicate scheduled absentee bid", async () => {
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
    } as unknown as ILotRepository;
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue({ code: "23505" }),
        }),
      }),
    } as unknown as Database;
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      {} as IBidPlacer,
      lotRepo,
      entitiesIn("approved"),
      null,
      okIdentityGate(),
      fakeBidAuthority("owner"),
    );
    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.status).toBe(409);
      expect(result.error.code).toBe("absentee_duplicate");
    }
  });

  it("fails closed when the identity eligibility gate is not configured", async () => {
    const insertScheduled = vi.fn();
    const svc = new AbsenteeBidService(
      { insertScheduled } as unknown as IAbsenteeBidRepository,
      {} as IBidPlacer,
      {
        findById: vi.fn().mockResolvedValue(mkLot({ status: "scheduled" })),
      } as unknown as ILotRepository,
      entitiesIn("approved"),
      null,
      null,
      fakeBidAuthority("owner"),
    );

    const result = await svc.schedule({
      userId: "u1",
      lotId: "lot-1",
      buyerLegalEntityId: "le-1",
      maxAmount: 500,
    });

    expect(result.isErr() && [result.error.status, result.error.code]).toEqual([
      503,
      "identity_gate_unconfigured",
    ]);
    expect(insertScheduled).not.toHaveBeenCalled();
  });

  it("marks absentee lost when opening bid exceeds max", async () => {
    const activeLot = mkLot({ currentPrice: "200.00", minBidIncrement: "10.00" });
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(activeLot),
    } as unknown as ILotRepository;
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: updateWhere }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "abs-1",
                maxAmount: "205.00",
                userId: "u1",
                buyerLegalEntityId: "le-1",
                status: "scheduled",
              },
            ]),
          }),
        }),
      }),
    } as unknown as Database;
    const placeBid = vi.fn();
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      { placeBid } as unknown as IBidPlacer,
      lotRepo,
      entitiesIn("approved"),
      null,
      null,
      fakeBidAuthority("owner"),
    );
    await svc.replayScheduledForLot("lot-1");
    expect(placeBid).not.toHaveBeenCalled();
    expect(updateWhere).toHaveBeenCalled();
  });

  it("executes absentee bid via placeBid with absentee placement", async () => {
    const activeLot = mkLot({ currentPrice: "100.00", minBidIncrement: "10.00" });
    const lotRepo: ILotRepository = {
      findById: vi.fn().mockResolvedValue(activeLot),
    } as unknown as ILotRepository;
    const db = {
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "abs-1" }]),
          })),
        }),
      })),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: "abs-1",
                maxAmount: "500.00",
                userId: "u1",
                buyerLegalEntityId: "le-1",
                status: "scheduled",
              },
            ]),
          }),
        }),
      }),
    } as unknown as Database;
    const placeBid = vi.fn().mockResolvedValue(ok({ id: "bid-1" }));
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      { placeBid } as unknown as IBidPlacer,
      lotRepo,
      entitiesIn("approved"),
      null,
      null,
      fakeBidAuthority("owner"),
    );
    await svc.replayScheduledForLot("lot-1");
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({
        lotId: "lot-1",
        amount: 110,
        maxAutoBidAmount: 500,
        placement: { placedVia: "absentee" },
      }),
    );
  });

  it("expireStaleExecutingLeases marks stale executing rows lost", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Database;
    const svc = new AbsenteeBidService(
      new DrizzleAbsenteeBidRepository(db),
      {} as IBidPlacer,
      { findById: vi.fn() } as unknown as ILotRepository,
      entitiesIn("approved"),
      null,
      null,
      fakeBidAuthority("owner"),
    );
    await svc.expireStaleExecutingLeases();
    expect(where).toHaveBeenCalled();
  });
});
