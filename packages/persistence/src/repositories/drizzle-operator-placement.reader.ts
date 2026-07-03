import type { Database } from "@auction/db";
import { saleRegistration, telephoneBidBooking } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IOperatorPlacementReader } from "../interfaces/operator-placement.reader.js";

export class DrizzleOperatorPlacementReader implements IOperatorPlacementReader {
  constructor(private readonly db: Database) {}

  async findTelephoneBookingPlacement(bookingId: string) {
    const [row] = await this.db
      .select({ status: telephoneBidBooking.status, saleId: telephoneBidBooking.saleId })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    if (!row?.saleId) return null;
    return { saleId: row.saleId, status: row.status };
  }

  async findTelephoneBookingCap(bookingId: string) {
    const [row] = await this.db
      .select({ reserveAltMax: telephoneBidBooking.reserveAltMax })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    if (!row) return null;
    return {
      reserveAltMax: row.reserveAltMax != null ? String(row.reserveAltMax) : null,
    };
  }

  async findPaddleRegistration(saleId: string, paddleNumber: number) {
    const [row] = await this.db
      .select({ bidLimit: saleRegistration.bidLimit, status: saleRegistration.status })
      .from(saleRegistration)
      .where(
        and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.paddleNumber, paddleNumber)),
      )
      .limit(1);
    if (!row) return null;
    return {
      bidLimit: row.bidLimit != null ? String(row.bidLimit) : null,
      status: row.status,
    };
  }
}
