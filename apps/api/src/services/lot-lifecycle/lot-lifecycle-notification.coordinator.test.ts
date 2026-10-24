import type { IBidRepository, ILotRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import type { ILotNotificationSender } from "../interfaces/notifications.js";
import {
  baseLot,
  bid,
  createClerkOutcomeStack,
  createFactory,
  createNotificationCoordinatorStack,
  createTimedRunnerStack,
} from "./lot-lifecycle.test-helpers.js";

describe("LotLifecycleNotificationCoordinator", () => {
  it("publishes lot_ended over realtime when reserve is met on timed close", async () => {
    const winningBid = bid({ amount: "500.00", bidderId: "winner" });
    const lot = baseLot({
      reservePrice: "400.00",
      currentPrice: "500.00",
    });

    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lot]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([winningBid]),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["winner"]),
    } as unknown as IBidRepository;

    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const lotNotifications: ILotNotificationSender = {
      notifyLotExtended: vi.fn(),
      notifyLotEnded,
      notifyProxyCancelled: vi.fn(),
    };

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
      lotNotifications,
    });
    await timedRunner.runTransitions(new Date());

    expect(notifyLotEnded).toHaveBeenCalledWith(lot, winningBid, {
      trigger: "timed",
      hadBids: true,
      voided: false,
    });
  });

  it("publishes lot_ended with null winning bid when reserve is not met on timed close", async () => {
    const lot = baseLot({
      reservePrice: "1000.00",
      currentPrice: "500.00",
    });

    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lot]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1"]),
    } as unknown as IBidRepository;

    const notifyLotEnded = vi.fn().mockResolvedValue(undefined);
    const lotNotifications: ILotNotificationSender = {
      notifyLotExtended: vi.fn(),
      notifyLotEnded,
      notifyProxyCancelled: vi.fn(),
    };

    const { timedRunner } = createTimedRunnerStack({
      repos: createFactory(lots, bids),
      lotNotifications,
    });
    await timedRunner.runTransitions(new Date());

    expect(notifyLotEnded).toHaveBeenCalledWith(lot, null, {
      trigger: "timed",
      hadBids: true,
      voided: false,
    });
  });

  it("stages lot_lost for bidders when reserve is not met at timed close", async () => {
    const lot = baseLot({
      reservePrice: "1000.00",
      currentPrice: "500.00",
    });

    const lots: ILotRepository = {
      findScheduledToActivate: vi.fn().mockResolvedValue([]),
      findActivePastEnd: vi.fn().mockResolvedValue([lot]),
      findActiveByEndTimeBetween: vi.fn().mockResolvedValue([]),
      findByIdForUpdate: vi.fn().mockResolvedValue(lot),
      updateStatus: vi.fn(),
      setWinner: vi.fn(),
      findActiveDutchLots: vi.fn().mockResolvedValue([]),
      setDutchLastDecrementAt: vi.fn(),
      updateDutchCurrentPrice: vi.fn(),
      updateDutchCurrentPriceIfMatch: vi.fn().mockResolvedValue(true),
      voidLotAntiShillingClose: vi.fn(),
    } as unknown as ILotRepository;

    const bids: IBidRepository = {
      listForLotSettlement: vi.fn().mockResolvedValue([bid({ amount: "500.00" })]),
      findEligibleBidsForLotClose: vi.fn(),
      listDistinctBidderIds: vi.fn().mockResolvedValue(["u1", "u2"]),
    } as unknown as IBidRepository;

    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const notificationOutbox: INotificationOutboxService = { stageDispatch };

    createNotificationCoordinatorStack({
      repos: createFactory(lots, bids),
      notificationOutbox,
    });

    const { clerkOutcomes } = createClerkOutcomeStack({
      repos: createFactory(lots, bids),
      notificationOutbox,
    });

    await clerkOutcomes.finalizeTimedLotEnding(lot, new Date());

    expect(stageDispatch).toHaveBeenCalledTimes(3);
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "s1",
        idempotencyKey: "lot_ended_seller:a1:s1",
        payload: expect.objectContaining({
          type: "lot_ended_seller",
          meta: expect.objectContaining({ outcome: "unsold" }),
        }),
      }),
      expect.anything(),
    );
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        idempotencyKey: "lot_lost:a1:u1",
      }),
      expect.anything(),
    );
    expect(stageDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u2",
        idempotencyKey: "lot_lost:a1:u2",
      }),
      expect.anything(),
    );
  });

  it("tells the consignor the hammer price when the lot sells", async () => {
    const lot = baseLot({ reservePrice: "400.00", currentPrice: "500.00" });
    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const coordinator = createNotificationCoordinatorStack({
      repos: createFactory({} as ILotRepository, {} as IBidRepository),
      notificationOutbox: { stageDispatch },
    });

    await coordinator.stageLotCloseNotificationsInTransaction({
      lot,
      winnerId: "winner",
      bid: {
        listDistinctBidderIds: vi.fn().mockResolvedValue(["winner"]),
      } as unknown as IBidRepository,
      tx: {} as never,
    });

    const sellerCall = stageDispatch.mock.calls
      .map(([input]) => input)
      .find((input) => input.payload.type === "lot_ended_seller");
    expect(sellerCall.userId).toBe("s1");
    expect(sellerCall.payload.meta).toMatchObject({ outcome: "sold", hammerPrice: "500.00" });
  });

  it("does not stage a seller notice when the lot has no consignor", async () => {
    const lot = baseLot({ sellerId: undefined as unknown as string });
    const stageDispatch = vi.fn().mockResolvedValue(undefined);
    const coordinator = createNotificationCoordinatorStack({
      repos: createFactory({} as ILotRepository, {} as IBidRepository),
      notificationOutbox: { stageDispatch },
    });

    await coordinator.stageLotCloseNotificationsInTransaction({
      lot,
      winnerId: null,
      bid: { listDistinctBidderIds: vi.fn().mockResolvedValue([]) } as unknown as IBidRepository,
      tx: {} as never,
    });

    expect(stageDispatch).not.toHaveBeenCalled();
  });
});
