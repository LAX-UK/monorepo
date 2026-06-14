import type { Database } from "@auction/db";
import { saleRegistration, telephoneBidBooking } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { BidError } from "../../lib/errors.js";
import { isOperatorPlacement } from "../interfaces/auction-strategy.js";

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

function parseMoneyCap(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export class OperatorPlacementPolicy {
  constructor(private readonly db: Database) {}

  applies(placedVia?: string | null): boolean {
    return isOperatorPlacement(placedVia);
  }

  bypassChecks(placedVia?: string | null): OperatorBypassChecks {
    if (placedVia === "telephone" || placedVia === "saleroom") {
      return { saleRegistration: true, buyerAgentAuth: true };
    }
    return { saleRegistration: false, buyerAgentAuth: false };
  }

  async isActiveTelephoneBooking(bookingId: string, saleId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ status: telephoneBidBooking.status, saleId: telephoneBidBooking.saleId })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    if (!row || row.saleId !== saleId) return false;
    return row.status === "confirmed" || row.status === "in_progress";
  }

  async resolveOperatorCap(input: OperatorCapInput): Promise<number | null> {
    const { placedVia, telephoneBookingId, saleId, paddleNumber } = input;
    if (placedVia === "telephone" && telephoneBookingId) {
      const [row] = await this.db
        .select({ reserveAltMax: telephoneBidBooking.reserveAltMax })
        .from(telephoneBidBooking)
        .where(eq(telephoneBidBooking.id, telephoneBookingId))
        .limit(1);
      return parseMoneyCap(row?.reserveAltMax != null ? String(row.reserveAltMax) : null);
    }
    if (placedVia === "saleroom" && saleId && paddleNumber != null) {
      const [row] = await this.db
        .select({ bidLimit: saleRegistration.bidLimit, status: saleRegistration.status })
        .from(saleRegistration)
        .where(
          and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.paddleNumber, paddleNumber)),
        )
        .limit(1);
      if (!row || row.status !== "approved") {
        throw new BidError("Paddle is not registered for this sale", 403, "paddle_not_registered");
      }
      return parseMoneyCap(row.bidLimit != null ? String(row.bidLimit) : null);
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
