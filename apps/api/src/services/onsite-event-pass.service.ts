import type { IGuestPaddleReader } from "@auction/persistence/interfaces";
import type { IOnsiteEventRsvpRepository } from "@auction/persistence/interfaces";
import type { IOnsiteEventRepository } from "@auction/persistence/interfaces";
import type { OnsiteEventPassView } from "@auction/types";
import {
  buildPassUrl,
  hashCheckInToken,
  normaliseCheckInToken,
} from "../lib/onsite-event-check-in-token.js";
import { partySize } from "../lib/onsite-event-check-in.mapper.js";
import { segmentLabelFor } from "../lib/onsite-event.mapper.js";
import type { IOnsiteEventPassService } from "./interfaces/onsite-event-pass-service.js";
import type { OnsiteEventCheckInServiceError } from "./interfaces/onsite-event-service-errors.js";
import { OnsiteEventAccessGuard } from "./onsite-event-access-guard.js";
import type { PassQrRenderService } from "./pass-qr-render.service.js";

export class OnsiteEventPassService implements IOnsiteEventPassService {
  private readonly guard: OnsiteEventAccessGuard;

  constructor(
    eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly qrRender: PassQrRenderService,
    private readonly guestPaddleReader: IGuestPaddleReader | null = null,
  ) {
    this.guard = new OnsiteEventAccessGuard(eventRepo);
  }

  private notFound(): OnsiteEventCheckInServiceError {
    return { message: "Pass not found", status: 404, code: "pass_not_found" };
  }

  async getPassView(
    eventSlug: string,
    plainToken: string,
    apiBaseUrl: string,
  ): Promise<OnsiteEventPassView | OnsiteEventCheckInServiceError> {
    const event = await this.guard.requirePublicEvent(eventSlug);
    if ("message" in event) return this.notFound();

    const normalised = normaliseCheckInToken(plainToken);
    if (!normalised) return this.notFound();

    const tokenHash = hashCheckInToken(normalised);
    const rsvp = await this.rsvpRepo.findByTokenHash(tokenHash);

    if (!rsvp) {
      return this.notFound();
    }

    if (rsvp.eventSlug !== eventSlug) {
      return this.notFound();
    }

    const passUrl = buildPassUrl(event.micrositeUrl, normalised);
    const base = apiBaseUrl.replace(/\/$/, "");
    const qrImageUrl = `${base}/events/${eventSlug}/pass/${encodeURIComponent(normalised)}/qr.svg`;
    const paddleNumber =
      event.saleId && this.guestPaddleReader
        ? await this.guestPaddleReader.findCheckedInPaddle(event.saleId, rsvp.userId)
        : null;

    return {
      slug: event.slug,
      title: event.title,
      guestName: rsvp.guestName,
      attendanceSegment: rsvp.attendanceSegment,
      attendanceSegmentLabel: segmentLabelFor(event, rsvp.attendanceSegment),
      plusOne: rsvp.plusOne,
      plusOneGuestName: rsvp.plusOneGuestName,
      partySize: partySize(rsvp),
      startsAt: event.startsAt?.toISOString() ?? null,
      venue: event.venue,
      dressCode: event.dressCode,
      passUrl,
      qrImageUrl,
      checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
      eventClosed: this.guard.isEventClosed(event),
      paddleNumber,
    };
  }

  async getPassViewByToken(
    plainToken: string,
    apiBaseUrl: string,
  ): Promise<OnsiteEventPassView | OnsiteEventCheckInServiceError> {
    const normalised = normaliseCheckInToken(plainToken);
    if (!normalised) return this.notFound();

    const tokenHash = hashCheckInToken(normalised);
    const rsvp = await this.rsvpRepo.findByTokenHash(tokenHash);
    if (!rsvp) return this.notFound();

    return this.getPassView(rsvp.eventSlug, normalised, apiBaseUrl);
  }

  async renderPassQrSvg(passUrl: string): Promise<string> {
    return this.qrRender.renderSvg(passUrl);
  }
}
