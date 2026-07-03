import type { Database } from "@auction/db";
import { bid, sale } from "@auction/db/schema";
import type { TelephoneBidBooking } from "@auction/types";
import { eq } from "drizzle-orm";
import type { TelephoneBidBookingDetail } from "../interfaces/telephone-bid-booking-detail.reader.js";
import type { ITelephoneBidBookingDetailReader } from "../interfaces/telephone-bid-booking-detail.reader.js";

export class DrizzleTelephoneBidBookingDetailReader implements ITelephoneBidBookingDetailReader {
  constructor(private readonly db: Database) {}

  async enrichForUser(booking: TelephoneBidBooking): Promise<TelephoneBidBookingDetail> {
    const [saleRow] = await this.db
      .select({ title: sale.title })
      .from(sale)
      .where(eq(sale.id, booking.saleId))
      .limit(1);

    const bidRows = await this.db
      .select({
        id: bid.id,
        lotId: bid.lotId,
        amount: bid.amount,
        isWinning: bid.isWinning,
        createdAt: bid.createdAt,
      })
      .from(bid)
      .where(eq(bid.telephoneBookingId, booking.id));

    return {
      ...booking,
      saleTitle: saleRow?.title ?? null,
      linkedBids: bidRows.map((r) => ({
        id: r.id,
        lotId: r.lotId,
        amount: String(r.amount),
        isWinning: r.isWinning,
        createdAt: r.createdAt,
      })),
    };
  }
}
