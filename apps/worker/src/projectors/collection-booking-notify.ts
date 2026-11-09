import type { CollectionCancelReason, CollectionCancelledVia } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type pino from "pino";
import {
  type CollectionChange,
  type CollectionNoticeConfig,
  collectionEmailsFor,
} from "../services/collection-notices.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const COLLECTION_BOOKING_NOTIFY_PROJECTOR = "collection_booking_notify";

type Payload = {
  bookingId?: string;
  previousSlotStart?: string;
  noticeDeadline?: string;
  cancelledVia?: CollectionCancelledVia;
  reason?: CollectionCancelReason;
};

const asDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function changeOf(eventType: string, eventId: number, payload: Payload): CollectionChange | null {
  switch (eventType) {
    case "collection.booking.created":
      return { kind: "created", eventId, noticeDeadline: asDate(payload.noticeDeadline) };
    case "collection.booking.changed": {
      const previous = asDate(payload.previousSlotStart);
      return previous
        ? {
            kind: "changed",
            eventId,
            previousSlotStart: previous,
            noticeDeadline: asDate(payload.noticeDeadline),
          }
        : null;
    }
    case "collection.booking.cancelled":
      return {
        kind: "cancelled",
        eventId,
        cancelledVia: payload.cancelledVia ?? "staff",
        reason: payload.reason,
      };
    default:
      return null;
  }
}

/**
 * Sends the emails for collection bookings made, changed and cancelled, from the audit events
 * written in the same transaction as the booking. So a booking and its email can never disagree:
 * if the booking is stored its event is, and the email follows, once. A cancellation by the
 * buyer, by staff (hours or a closure changed) or by Bid when the booker erased their account all
 * arrive here, and the wording follows who ended it.
 */
export async function processCollectionBookingNotify(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
  emailService: IEmailService;
  config: Omit<CollectionNoticeConfig, "now">;
  now?: () => Date;
}): Promise<void> {
  const { ctx, log, emailService, config, now = () => new Date() } = options;
  const { projectorStateRepo, domainEventReader, collectionNoticeReader } = ctx;
  if (!collectionNoticeReader) return;

  const cursor = await projectorStateRepo.getCursor(COLLECTION_BOOKING_NOTIFY_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [
      "collection.booking.created",
      "collection.booking.changed",
      "collection.booking.cancelled",
    ],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    const payload = row.payload as Payload;
    const change = changeOf(row.eventType, row.id, payload);
    if (!change || !payload.bookingId) {
      log.warn({ eventId: row.id }, "collection_booking_notify_skipped_malformed_payload");
      maxId = row.id;
      continue;
    }
    try {
      const visit = await collectionNoticeReader.visit(payload.bookingId);
      if (visit) {
        for (const email of collectionEmailsFor(change, visit, { ...config, now: now() })) {
          await emailService.enqueue(email);
        }
      }
      maxId = row.id;
    } catch (err) {
      log.error({ err, eventId: row.id }, "collection_booking_notify_failed");
      break;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(COLLECTION_BOOKING_NOTIFY_PROJECTOR, maxId);
  }
}
