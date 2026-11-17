import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import {
  baseLot,
  bid,
  createClerkOutcomeStack,
  createFactory,
} from "./lot-lifecycle.test-helpers.js";

describe("ClerkLotOutcomeService", () => {
  it("stages lot_lost for bidders on clerk no-sale", async () => {
    const lot = baseLot();

    const lots: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lot),
      findByIdForUpdate: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      findScheduledToActivate: vi.fn(),
      findActivePastEnd: vi.fn(),
      findActiveByEndTimeBetween: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn(),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn(),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const clearWinningBid = vi.fn();
    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["bidder-a"]),
      listDistinctBidderAccounts: vi
        .fn()
        .mockResolvedValue(["bidder-a"].map((userId) => ({ userId, legalEntityId: null }))),
      clearWinningBid,
    } as unknown as IBidRepository;

    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const notificationOutbox: INotificationOutboxService = { stageDispatch };

    const { clerkOutcomes } = createClerkOutcomeStack({
      repos: createFactory(lots, bids),
      notificationOutbox,
    });

    await expect(clerkOutcomes.noSaleEndActiveLotFromClerk("a1")).resolves.toBe(true);
    expect(clearWinningBid).toHaveBeenCalledWith("a1");
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "bidder-a",
        idempotencyKey: "lot_lost:a1:bidder-a",
      }),
      expect.anything(),
    );
  });

  it("does not set winner on clerk hammer when reserve is not met", async () => {
    const lotRow = baseLot({
      reservePrice: "1000.00",
      currentPrice: "500.00",
    });
    const lots: ILotRepository = {
      findById: vi.fn().mockResolvedValue(lotRow),
      findByIdForUpdate: vi.fn().mockResolvedValue(lotRow),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findScheduledToActivate: vi.fn(),
      findActivePastEnd: vi.fn(),
      findActiveByEndTimeBetween: vi.fn(),
      findActiveDutchLots: vi.fn(),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn(),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const clearWinningBid = vi.fn();
    const bids: IBidRepository = {
      findEligibleBidsForLotClose: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", buyerLegalEntityId: "le-1" })]),
      listForLotSettlement: vi
        .fn()
        .mockResolvedValue([bid({ amount: "500.00", buyerLegalEntityId: "le-1" })]),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
      listDistinctBidderAccounts: vi
        .fn()
        .mockResolvedValue(["u1"].map((userId) => ({ userId, legalEntityId: null }))),
      clearWinningBid,
    } as unknown as IBidRepository;

    const { clerkOutcomes } = createClerkOutcomeStack({
      repos: createFactory(lots, bids),
    });

    const outcome = await clerkOutcomes.finalizeActiveLotFromClerkHammer("a1");
    expect(outcome?.winnerId).toBeNull();
    expect(lots.setWinner).not.toHaveBeenCalled();
    expect(clearWinningBid).toHaveBeenCalledWith("a1");
  });

  describe("inOutcomeTransaction", () => {
    /** A factory whose transaction hands out a recognisable tx and records when it is open. */
    function stackWithTrackedTransaction(lotRow: ReturnType<typeof baseLot>, lockedRow = lotRow) {
      const lots = {
        findById: vi.fn().mockResolvedValue(lotRow),
        findByIdForUpdate: vi.fn().mockResolvedValue(lockedRow),
        updateStatus: vi.fn(),
        setWinner: vi.fn(),
        voidLotAntiShillingClose: vi.fn(),
      } as unknown as ILotRepository;
      const bids = {
        findEligibleBidsForLotClose: vi.fn().mockResolvedValue([]),
        listForLotSettlement: vi.fn().mockResolvedValue([]),
        listDistinctBidderIds: vi.fn().mockResolvedValue([]),
        listDistinctBidderAccounts: vi.fn().mockResolvedValue([]),
        clearWinningBid: vi.fn(),
      } as unknown as IBidRepository;
      const base = createFactory(lots, bids);
      const outcomeTx = { outcomeTx: true } as never;
      const state = { inTransaction: false };
      const repos = {
        ...base,
        runInTransaction: async <T>(fn: (r: typeof base.root, tx: never) => Promise<T>) => {
          state.inTransaction = true;
          try {
            return await fn(base.root, outcomeTx);
          } finally {
            state.inTransaction = false;
          }
        },
      };
      const { clerkOutcomes } = createClerkOutcomeStack({ repos });
      const hook = vi.fn(async (tx: unknown) => {
        expect(tx).toBe(outcomeTx);
        expect(state.inTransaction).toBe(true);
        // The outcome is already written when the hook runs.
        expect(lots.updateStatus).toHaveBeenCalledWith(lotRow.id, "ended");
      });
      return { clerkOutcomes, hook };
    }

    it("runs inside the hammer's outcome transaction, after the lot is ended", async () => {
      const { clerkOutcomes, hook } = stackWithTrackedTransaction(baseLot());

      await expect(
        clerkOutcomes.finalizeActiveLotFromClerkHammer("a1", { inOutcomeTransaction: hook }),
      ).resolves.toEqual({ winnerId: null, voided: false });
      expect(hook).toHaveBeenCalledTimes(1);
    });

    it("runs inside the no-sale outcome transaction, after the lot is ended", async () => {
      const { clerkOutcomes, hook } = stackWithTrackedTransaction(baseLot());

      await expect(
        clerkOutcomes.noSaleEndActiveLotFromClerk("a1", { inOutcomeTransaction: hook }),
      ).resolves.toBe(true);
      expect(hook).toHaveBeenCalledTimes(1);
    });

    it("does not run when the lot was closed by someone else before the lock", async () => {
      const lot = baseLot();
      const { clerkOutcomes, hook } = stackWithTrackedTransaction(lot, { ...lot, status: "ended" });

      await expect(
        clerkOutcomes.finalizeActiveLotFromClerkHammer("a1", { inOutcomeTransaction: hook }),
      ).resolves.toBeNull();
      await expect(
        clerkOutcomes.noSaleEndActiveLotFromClerk("a1", { inOutcomeTransaction: hook }),
      ).resolves.toBe(false);
      expect(hook).not.toHaveBeenCalled();
    });
  });
});
