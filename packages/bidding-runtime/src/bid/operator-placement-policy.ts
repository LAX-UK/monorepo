import { BidError } from "../bid-error.js";
import type { IOperatorPlacementReader } from "../ports.js";
import { parseMoneyCap } from "./bid-cap.util.js";

export class OperatorPlacementPolicy {
  constructor(private readonly reader: IOperatorPlacementReader) {}

  async isActiveTelephoneBooking(
    bookingId: string,
    saleId: string,
    userId: string,
    buyerLegalEntityId: string,
  ): Promise<boolean> {
    const row = await this.reader.findTelephoneBookingPlacement(bookingId);
    return (
      row?.saleId === saleId &&
      row.userId === userId &&
      row.buyerLegalEntityId === buyerLegalEntityId &&
      (row.status === "confirmed" || row.status === "in_progress")
    );
  }

  async resolveOperatorCap(input: {
    placedVia?: string | null;
    telephoneBookingId?: string | null;
    saleId?: string | null;
    paddleNumber?: number | null;
  }): Promise<number | null> {
    if (input.placedVia === "telephone" && input.telephoneBookingId) {
      const row = await this.reader.findTelephoneBookingCap(input.telephoneBookingId);
      return parseMoneyCap(row?.reserveAltMax);
    }
    if (input.placedVia === "saleroom" && input.saleId && input.paddleNumber != null) {
      const row = await this.reader.findPaddleRegistration(input.saleId, input.paddleNumber);
      if (!row || row.status !== "approved") {
        throw new BidError("Paddle is not registered for this sale", 403, "paddle_not_registered");
      }
      return parseMoneyCap(row.bidLimit);
    }
    return null;
  }

  assertCapNotExceeded(
    cap: number | null,
    effectiveAmount: number,
    placedVia?: string | null,
  ): void {
    if (cap == null || effectiveAmount <= cap + 1e-9) return;
    if (placedVia === "telephone") {
      throw new BidError("Bid exceeds authorized telephone limit", 403, "authorized_max_exceeded");
    }
    throw new BidError("Bid exceeds authorized limit", 403, "bid_limit_exceeded");
  }
}
