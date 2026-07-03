import { ok } from "neverthrow";
import { parseAuthorizedMaxCap } from "../../lib/telephone-booking.mapper.js";
import type { ITelephoneBidBookingBidPolicy } from "../interfaces/telephone-bid-booking-service.js";
import type { TelephoneBidBookingContext } from "./telephone-bid-booking-context.js";
import { telephoneBookingErr } from "./telephone-booking-validation.js";

export class TelephoneBidBookingBidPolicyService implements ITelephoneBidBookingBidPolicy {
  constructor(private readonly ctx: TelephoneBidBookingContext) {}

  async assertBookingAllowsTelephoneBid(input: {
    bookingId: string;
    saleId: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
  }) {
    const booking = await this.ctx.repo.findById(input.bookingId);
    if (!booking) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }
    if (booking.saleId !== input.saleId) {
      return telephoneBookingErr("Telephone booking does not belong to this sale", 400);
    }
    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      return telephoneBookingErr(
        "Telephone booking is not active",
        400,
        "invalid_status_transition",
      );
    }
    if (booking.lotIds.length > 0 && !booking.lotIds.includes(input.lotId)) {
      return telephoneBookingErr(
        "This lot is not part of the telephone booking",
        400,
        "lot_not_in_booking",
      );
    }

    const cap = parseAuthorizedMaxCap(booking.authorizedMax);
    const effective =
      input.maxAutoBidAmount != null && Number.isFinite(input.maxAutoBidAmount)
        ? Math.max(input.amount, input.maxAutoBidAmount)
        : input.amount;
    if (cap != null && effective > cap + 1e-9) {
      return telephoneBookingErr(
        "Bid exceeds authorized telephone limit",
        403,
        "authorized_max_exceeded",
      );
    }

    return ok(booking);
  }
}
