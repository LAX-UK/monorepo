import { isOperatorPlacement } from "@auction/domain";
import type { IOperatorPlacementReader } from "@auction/persistence/interfaces";
import { BidError } from "../bid-error.js";
import { parseMoneyCap } from "./bid-cap.util.js";

export type OperatorBypassChecks = {
  saleRegistration: boolean;
  buyerAgentAuth: boolean;
};

export type OperatorCapInput = {
  placedVia?: string | null;
  telephoneBookingId?: string | null;
  saleId?: string | null;
  paddleNumber?: number | null;
};

export class OperatorPlacementPolicy {
  constructor(private readonly reader: IOperatorPlacementReader) {}

  applies(placedVia?: string | null): boolean {
    return isOperatorPlacement(placedVia);
  }

  bypassChecks(placedVia?: string | null): OperatorBypassChecks {
    if (placedVia === "telephone" || placedVia === "saleroom") {
      return { saleRegistration: true, buyerAgentAuth: true };
    }
    return { saleRegistration: false, buyerAgentAuth: false };
  }

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

  async resolveOperatorCap(input: OperatorCapInput): Promise<number | null> {
    const { placedVia, telephoneBookingId, saleId, paddleNumber } = input;
    if (placedVia === "telephone" && telephoneBookingId) {
      const row = await this.reader.findTelephoneBookingCap(telephoneBookingId);
      return parseMoneyCap(row?.reserveAltMax ?? null);
    }
    if (placedVia === "saleroom" && saleId && paddleNumber != null) {
      const row = await this.reader.findPaddleRegistration(saleId, paddleNumber);
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
    if (cap != null && effectiveAmount > cap + 1e-9) {
      if (placedVia === "telephone") {
        throw new BidError(
          "Bid exceeds authorized telephone limit",
          403,
          "authorized_max_exceeded",
        );
      }
      throw new BidError("Bid exceeds authorized limit", 403, "bid_limit_exceeded");
    }
  }
}
