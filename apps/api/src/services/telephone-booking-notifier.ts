import type { Database } from "@auction/db";
import { sale, user } from "@auction/db/schema";
import type { TelephoneBidBooking } from "@auction/types";
import { eq } from "drizzle-orm";
import type { INotificationWriteRepository } from "./interfaces/notification-write.js";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";

async function listStaffOpsEmails(db: Database, fallback?: string): Promise<string[]> {
  const rows = await db.select({ email: user.email }).from(user).where(eq(user.role, "staff"));
  const emails = rows.map((r) => r.email).filter((e): e is string => Boolean(e?.trim()));
  if (emails.length > 0) return [...new Set(emails)];
  return fallback ? [fallback] : [];
}

export class TelephoneBookingNotifier {
  constructor(
    private readonly db: Database,
    private readonly mailer: ITransactionalMailer,
    private readonly notifications: INotificationWriteRepository,
    private readonly webOrigin: string,
    private readonly opsSupportEmail?: string,
  ) {}

  private adminSaleUrl(saleId: string): string {
    const base = this.webOrigin.replace(/\/$/, "");
    return `${base}/admin/sales/${saleId}/telephone-bookings`;
  }

  private buyerDetailUrl(bookingId: string): string {
    const base = this.webOrigin.replace(/\/$/, "");
    return `${base}/dashboard/telephone-bids/${bookingId}`;
  }

  private async saleTitle(saleId: string): Promise<string> {
    const [row] = await this.db
      .select({ title: sale.title })
      .from(sale)
      .where(eq(sale.id, saleId))
      .limit(1);
    return row?.title ?? "Sale";
  }

  private async buyerEmail(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.email?.trim() ?? null;
  }

  async notifyRequested(booking: TelephoneBidBooking): Promise<void> {
    const title = await this.saleTitle(booking.saleId);
    const adminUrl = this.adminSaleUrl(booking.saleId);
    const lotNote =
      booking.lotIds.length > 0
        ? `${booking.lotIds.length} lot(s) of interest`
        : "Sale-wide line (no lots specified yet)";

    const recipients = await listStaffOpsEmails(this.db, this.opsSupportEmail);
    await Promise.all(
      recipients.map((to) =>
        this.mailer.send({
          to,
          subject: `Telephone bidding request — ${title}`,
          text: [
            `A buyer requested a telephone bidding line for ${title}.`,
            `Phone (profile snapshot): ${booking.phoneE164}`,
            lotNote,
            booking.authorizedMax ? `Authorized max: ${booking.authorizedMax}` : null,
            booking.buyerNotes ? `Buyer notes: ${booking.buyerNotes}` : null,
            `Review queue: ${adminUrl}`,
          ]
            .filter(Boolean)
            .join("\n"),
          meta: { kind: "telephone_booking_requested", bookingId: booking.id },
        }),
      ),
    );
  }

  async notifyConfirmed(booking: TelephoneBidBooking): Promise<void> {
    const title = await this.saleTitle(booking.saleId);
    const email = await this.buyerEmail(booking.userId);
    const detailUrl = this.buyerDetailUrl(booking.id);

    await this.notifications.createMany([
      {
        userId: booking.userId,
        type: "telephone_booking_confirmed",
        title: "Telephone line confirmed",
        message: `Your telephone bidding line for ${title} is confirmed. We will call ${booking.phoneE164} before your lot opens.`,
      },
    ]);

    if (!email) return;
    await this.mailer.send({
      to: email,
      subject: `Telephone line confirmed — ${title}`,
      text: [
        `Your telephone bidding line for ${title} is confirmed.`,
        `We will call ${booking.phoneE164} when your lot is approaching the block.`,
        `Track your booking: ${detailUrl}`,
      ].join("\n"),
      meta: { kind: "telephone_booking_confirmed", bookingId: booking.id },
    });
  }

  async notifyCancelledByStaff(
    booking: TelephoneBidBooking,
    reason?: string | null,
  ): Promise<void> {
    const title = await this.saleTitle(booking.saleId);
    const email = await this.buyerEmail(booking.userId);

    await this.notifications.createMany([
      {
        userId: booking.userId,
        type: "telephone_booking_cancelled",
        title: "Telephone line cancelled",
        message: `Your telephone bidding line for ${title} was cancelled.${reason ? ` ${reason}` : ""}`,
      },
    ]);

    if (!email) return;
    await this.mailer.send({
      to: email,
      subject: `Telephone line cancelled — ${title}`,
      text: [
        `Your telephone bidding line for ${title} was cancelled.`,
        reason ? `Reason: ${reason}` : null,
        "Contact us if you have questions.",
      ]
        .filter(Boolean)
        .join("\n"),
      meta: { kind: "telephone_booking_cancelled", bookingId: booking.id },
    });
  }

  async notifyLimitIncreaseApproved(booking: TelephoneBidBooking): Promise<void> {
    const title = await this.saleTitle(booking.saleId);
    const email = await this.buyerEmail(booking.userId);
    const cap = booking.authorizedMax ?? booking.limitIncreaseAmount;

    await this.notifications.createMany([
      {
        userId: booking.userId,
        type: "telephone_limit_increase_approved",
        title: "Telephone limit updated",
        message: `Your authorized telephone limit for ${title} is now ${cap ?? "updated"}.`,
      },
    ]);

    if (!email) return;
    await this.mailer.send({
      to: email,
      subject: `Telephone limit approved — ${title}`,
      text: [
        `Your authorized telephone bidding limit for ${title} has been updated.`,
        cap ? `New limit: ${cap}` : null,
        `View booking: ${this.buyerDetailUrl(booking.id)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      meta: { kind: "telephone_limit_increase_approved", bookingId: booking.id },
    });
  }
}

export class NoOpTelephoneBookingNotifier {
  async notifyRequested(_booking: TelephoneBidBooking): Promise<void> {}
  async notifyConfirmed(_booking: TelephoneBidBooking): Promise<void> {}
  async notifyCancelledByStaff(
    _booking: TelephoneBidBooking,
    _reason?: string | null,
  ): Promise<void> {}
  async notifyLimitIncreaseApproved(_booking: TelephoneBidBooking): Promise<void> {}
}
