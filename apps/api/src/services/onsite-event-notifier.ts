import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { type AppLogger, createBaseLogger } from "../lib/logger.js";
import {
  ONSITE_PASS_QR_CONTENT_ID,
  buildOnsiteEventPassEmailHtml,
  buildOnsiteEventPassEmailSubject,
  buildOnsiteEventPassEmailText,
} from "../lib/onsite-event-pass-email.js";
import { segmentLabelFor } from "../lib/onsite-event.mapper.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";
import type { PassQrRenderService } from "./pass-qr-render.service.js";

export class OnsiteEventNotifier implements IOnsiteEventNotifier {
  private readonly log: AppLogger;

  constructor(
    private readonly mailer: ITransactionalMailer,
    private readonly qrRender: PassQrRenderService,
    private readonly fallbackOpsEmail: string,
    logger?: AppLogger,
  ) {
    this.log =
      logger ??
      createBaseLogger({ LOG_LEVEL: "fatal", NODE_ENV: "test" }).child({
        module: "onsite-event-notifier",
      });
  }

  async notifySubmitted(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
  ): Promise<void> {
    await this.send(event, rsvp, input, "confirmed");
  }

  async notifyUpdated(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
  ): Promise<void> {
    await this.send(event, rsvp, input, "updated");
  }

  async notifyResent(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
  ): Promise<void> {
    await this.send(event, rsvp, input, "resent", true);
  }

  private opsEmail(event: OnsiteEvent): string {
    return event.opsEmail?.trim() || this.fallbackOpsEmail;
  }

  private formatDetails(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string },
  ): string {
    const segment = segmentLabelFor(event, rsvp.attendanceSegment);
    const guestLine = rsvp.plusOne > 0 ? `\nGuest: ${rsvp.plusOneGuestName?.trim() || "+1"}` : "";
    const notesLine = rsvp.notes?.trim() ? `\nNotes: ${rsvp.notes.trim()}` : "";
    return [
      `Name: ${input.userName}`,
      `Email: ${input.userEmail}`,
      `Attendance: ${segment}${guestLine}${notesLine}`,
      `RSVP ID: ${rsvp.id}`,
    ].join("\n");
  }

  private async send(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
    kind: "confirmed" | "updated" | "resent",
    requireGuestDelivery = false,
  ): Promise<void> {
    const segment = segmentLabelFor(event, rsvp.attendanceSegment);
    const plusOneLine = rsvp.plusOne > 0 ? `Guest: ${rsvp.plusOneGuestName?.trim() || "+1"}` : null;
    const notesLine = rsvp.notes?.trim() ? `Notes: ${rsvp.notes.trim()}` : null;
    const details = this.formatDetails(event, rsvp, input);
    const opsEmail = this.opsEmail(event);
    const qrPngBase64 = await this.qrRender.renderPngBase64(input.passUrl);
    const emailInput = {
      userName: input.userName,
      eventTitle: event.title,
      segmentLabel: segment,
      plusOneLine,
      notesLine,
      passUrl: input.passUrl,
      opsEmail,
      arrivalNote: event.arrivalNote,
      dressCode: event.dressCode,
      kind,
    };

    const [guestResult, opsResult] = await Promise.allSettled([
      this.mailer.send({
        to: input.userEmail,
        subject: buildOnsiteEventPassEmailSubject(emailInput),
        text: buildOnsiteEventPassEmailText(emailInput),
        html: buildOnsiteEventPassEmailHtml(emailInput),
        inlineAttachments: [
          {
            contentId: ONSITE_PASS_QR_CONTENT_ID,
            filename: "entry-pass-qr.png",
            contentType: "image/png",
            contentBase64: qrPngBase64,
          },
        ],
        meta: { kind: `onsite_event_rsvp_${kind}`, rsvpId: rsvp.id, eventSlug: rsvp.eventSlug },
      }),
      this.mailer.send({
        to: opsEmail,
        subject:
          kind === "confirmed"
            ? `[${event.slug}] New RSVP — ${input.userName}`
            : kind === "updated"
              ? `[${event.slug}] RSVP updated — ${input.userName}`
              : `[${event.slug}] Pass resent — ${input.userName}`,
        text: [
          kind === "confirmed"
            ? "New onsite-event RSVP:"
            : kind === "updated"
              ? "Updated onsite-event RSVP:"
              : "Pass resent for onsite-event RSVP:",
          "",
          details,
          "",
          `Event: ${event.title} (${rsvp.eventSlug})`,
          `Updated: ${rsvp.updatedAt.toISOString()}`,
        ].join("\n"),
        meta: {
          kind: `onsite_event_rsvp_ops_${kind}`,
          rsvpId: rsvp.id,
          eventSlug: rsvp.eventSlug,
        },
      }),
    ]);

    if (guestResult.status === "rejected") {
      this.log.error(
        {
          kind,
          rsvpId: rsvp.id,
          eventSlug: rsvp.eventSlug,
          err: guestResult.reason,
        },
        "onsite_event_guest_email_failed",
      );
      if (requireGuestDelivery) {
        throw guestResult.reason instanceof Error
          ? guestResult.reason
          : new Error("Guest pass email could not be sent");
      }
    }

    if (opsResult.status === "rejected") {
      this.log.warn(
        {
          kind,
          rsvpId: rsvp.id,
          eventSlug: rsvp.eventSlug,
          err: opsResult.reason,
        },
        "onsite_event_ops_email_failed",
      );
    }
  }
}
