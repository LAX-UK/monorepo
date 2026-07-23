import { vi } from "vitest";
import type { BiddingRouteServices } from "../services/interfaces/bidding-routes/index.js";

export function stubBiddingRouteServices(
  overrides?: Partial<BiddingRouteServices>,
): BiddingRouteServices {
  return {
    placeBidHttp: { placeBid: vi.fn() },
    autoBidHttp: {
      getAutoBid: vi.fn(),
      setAutoBid: vi.fn(),
      clearAutoBid: vi.fn(),
    },
    absenteeBidHttp: { scheduleAbsentee: vi.fn() },
    saleRegistrationHttp: {
      requestRegistration: vi.fn(),
      listMineForSale: vi.fn(),
    },
    telephoneBookingHttp: {
      requestBooking: vi.fn(),
      findMineForSale: vi.fn(),
      listMineForUser: vi.fn(),
      getDetailForUser: vi.fn(),
      addLotsOfInterest: vi.fn(),
      requestLimitIncrease: vi.fn(),
      cancelByBuyer: vi.fn(),
    },
    lotBidHistoryHttp: {
      listForLot: vi.fn().mockResolvedValue({ kind: "ok", data: [] }),
    },
    conditionReportHttp: {
      findForBuyerOnLot: vi.fn(),
      createRequest: vi.fn(),
    },
    saleroomDisplayHttp: {
      startPairing: vi.fn(),
      pollPairing: vi.fn(),
      verifyDisplayTokenForSale: vi.fn(),
      getSnapshot: vi.fn(),
      heartbeat: vi.fn(),
    },
    ...overrides,
  };
}
