import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  ITelephoneBidBookingBidPolicy,
  ITelephoneBidBookingBuyerService,
  ITelephoneBidBookingQueryService,
  ITelephoneBidBookingSaleroomBridge,
  ITelephoneBidBookingService,
  ITelephoneBidBookingStaffService,
} from "./interfaces/telephone-bid-booking-service.js";
import type { TelephoneBidBookingService } from "./telephone-bid-booking.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: TelephoneBidBookingService;

type _Composite = AssertAssignable<typeof facade, ITelephoneBidBookingService>;
type _Buyer = AssertAssignable<typeof facade, ITelephoneBidBookingBuyerService>;
type _Staff = AssertAssignable<typeof facade, ITelephoneBidBookingStaffService>;
type _Query = AssertAssignable<typeof facade, ITelephoneBidBookingQueryService>;
type _Bridge = AssertAssignable<typeof facade, ITelephoneBidBookingSaleroomBridge>;
type _Policy = AssertAssignable<typeof facade, ITelephoneBidBookingBidPolicy>;

type _FacadeContract = [_Composite, _Buyer, _Staff, _Query, _Bridge, _Policy];

defineCompileTimeContract<_FacadeContract>();

describe("TelephoneBidBookingService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
