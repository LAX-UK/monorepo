import { lot, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { eq } from "drizzle-orm";
import type { Db, ProxyCancelledPayload } from "./notification-fanout-helpers.js";

export async function fanoutProxyCancelled(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  payload: ProxyCancelledPayload;
}) {
  if (!options.payload?.bidderUserId || !options.payload?.lotId) return;
  const [lotRow] = await options.db
    .select({ title: lot.title })
    .from(lot)
    .where(eq(lot.id, options.payload.lotId))
    .limit(1);
  const [bidder] = await options.db
    .select({ email: user.email, name: user.name, firstName: user.firstName })
    .from(user)
    .where(eq(user.id, options.payload.bidderUserId))
    .limit(1);
  if (!bidder?.email) return;
  await options.emailService.enqueue({
    template: "proxy-cancelled-notice",
    to: bidder.email,
    userId: options.payload.bidderUserId,
    vars: {
      userName: bidder.firstName ?? bidder.name,
      lotTitle: lotRow?.title ?? "Unknown Lot",
      reason: options.payload.reason,
      supportContactEmail: options.supportContactEmail,
    },
    category: "transactional",
    idempotencyKey: `proxy-cancelled-notice:${options.eventId}:${options.payload.bidderUserId}`,
  });
}
