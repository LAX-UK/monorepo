import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";
import { segmentLabelFor } from "../lib/onsite-event.mapper.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import type { ITransactionalMailer } from "./interfaces/transactional-mail.js";

export class OnsiteEventNotifier implements IOnsiteEventNotifier {
  constructor(
    private readonly mailer: ITransactionalMailer,
    private readonly fallbackOpsEmail: string,
  ) {}

  async notifySubmitted(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string },
  ): Promise<void> {
    await this.send(event, rsvp, input, "confirmed");
  }

  async notifyUpdated(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string },
  ): Promise<void> {
    await this.send(event, rsvp, input, "updated");
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
    input: { userEmail: string; userName: string },
    kind: "confirmed" | "updated",
  ): Promise<void> {
    const segment = segmentLabelFor(event, rsvp.attendanceSegment);
    const guestLine = rsvp.plusOne > 0 ? `\nGuest: ${rsvp.plusOneGuestName?.trim() || "+1"}` : "";
    const notesLine = rsvp.notes?.trim() ? `\nNotes: ${rsvp.notes.trim()}` : "";
    const details = this.formatDetails(event, rsvp, input);
    const opsEmail = this.opsEmail(event);

    await Promise.allSettled([
      this.mailer.send({
        to: input.userEmail,
        subject:
          kind === "confirmed"
            ? `RSVP confirmed — ${event.title}`
            : `RSVP updated — ${event.title}`,
        text: [
          `Dear ${input.userName},`,
          "",
          kind === "confirmed"
            ? `Thank you for confirming your attendance at ${event.title}.`
            : `Your RSVP for ${event.title} has been updated.`,
          "",
          `Attendance: ${segment}${guestLine}${notesLine}`,
          "",
          "We look forward to welcoming you.",
          "",
          `Questions: ${opsEmail}`,
        ].join("\n"),
        meta: { kind: `onsite_event_rsvp_${kind}`, rsvpId: rsvp.id, eventSlug: rsvp.eventSlug },
      }),
      this.mailer.send({
        to: opsEmail,
        subject:
          kind === "confirmed"
            ? `[${event.slug}] New RSVP — ${input.userName}`
            : `[${event.slug}] RSVP updated — ${input.userName}`,
        text: [
          kind === "confirmed" ? "New onsite-event RSVP:" : "Updated onsite-event RSVP:",
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
  }
}
