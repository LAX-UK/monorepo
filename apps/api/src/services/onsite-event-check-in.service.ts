import type {
  OnsiteEvent,
  OnsiteEventCheckInGuestSummary,
  OnsiteEventCheckInResult,
  OnsiteEventCheckInSearchRow,
  OnsiteEventPassView,
} from "@auction/types";
import { type AppLogger, createBaseLogger } from "../lib/logger.js";
import {
  buildPassUrl,
  hashCheckInInput,
  hashCheckInToken,
  normaliseCheckInToken,
} from "../lib/onsite-event-check-in-token.js";
import { segmentLabelFor } from "../lib/onsite-event.mapper.js";
import type { IOnsiteEventCheckInLogRepository } from "../repositories/interfaces/onsite-event-check-in-log.repository.js";
import type {
  IOnsiteEventRsvpRepository,
  OnsiteEventRsvpWithGuest,
} from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type {
  IOnsiteEventCheckInService,
  OnsiteEventCheckInServiceError,
} from "./interfaces/onsite-event-check-in-service.js";
import type { PassQrRenderService } from "./pass-qr-render.service.js";

export class OnsiteEventCheckInService implements IOnsiteEventCheckInService {
  private readonly log: AppLogger;

  constructor(
    private readonly eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly checkInLogRepo: IOnsiteEventCheckInLogRepository,
    private readonly qrRender: PassQrRenderService,
    logger?: AppLogger,
  ) {
    this.log =
      logger ??
      createBaseLogger({ LOG_LEVEL: "fatal", NODE_ENV: "test" }).child({
        module: "onsite-event-check-in",
      });
  }

  private notFound(): OnsiteEventCheckInServiceError {
    return { message: "Pass not found", status: 404, code: "pass_not_found" };
  }

  private async requireEvent(
    eventSlug: string,
  ): Promise<OnsiteEvent | OnsiteEventCheckInServiceError> {
    const event = await this.eventRepo.findBySlug(eventSlug);
    if (!event) return this.notFound();
    return event;
  }

  private async requirePublicEvent(
    eventSlug: string,
  ): Promise<OnsiteEvent | OnsiteEventCheckInServiceError> {
    const event = await this.requireEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    if (event.status === "draft") return this.notFound();
    return event;
  }

  private isEventClosed(event: OnsiteEvent): boolean {
    return event.status === "closed";
  }

  private partySize(rsvp: { plusOne: number }): number {
    return 1 + rsvp.plusOne;
  }

  private mapGuestSummary(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvpWithGuest,
  ): OnsiteEventCheckInGuestSummary {
    return {
      rsvpId: rsvp.id,
      name: rsvp.guestName,
      email: rsvp.guestEmail,
      attendanceSegment: rsvp.attendanceSegment,
      attendanceSegmentLabel: segmentLabelFor(event, rsvp.attendanceSegment),
      plusOne: rsvp.plusOne,
      plusOneGuestName: rsvp.plusOneGuestName,
      partySize: this.partySize(rsvp),
      checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
      checkedInByName: rsvp.checkedInByName,
    };
  }

  private async logAttempt(input: {
    rsvpId: string | null;
    eventSlug: string;
    staffUserId: string | null;
    result: OnsiteEventCheckInResult["status"] | "PASS_RESENT";
    rawInput: string;
  }): Promise<void> {
    try {
      await this.checkInLogRepo.insert({
        rsvpId: input.rsvpId,
        eventSlug: input.eventSlug,
        staffUserId: input.staffUserId,
        result: input.result,
        rawInputHash: hashCheckInInput(input.rawInput),
      });
    } catch (error) {
      this.log.error(
        {
          eventSlug: input.eventSlug,
          rsvpId: input.rsvpId,
          result: input.result,
          err: error,
        },
        "onsite_event_check_in_audit_insert_failed",
      );
    }
  }

  async getPassView(
    eventSlug: string,
    plainToken: string,
    apiBaseUrl: string,
  ): Promise<OnsiteEventPassView | OnsiteEventCheckInServiceError> {
    const event = await this.requirePublicEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;

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

    return {
      slug: event.slug,
      title: event.title,
      guestName: rsvp.guestName,
      attendanceSegment: rsvp.attendanceSegment,
      attendanceSegmentLabel: segmentLabelFor(event, rsvp.attendanceSegment),
      plusOne: rsvp.plusOne,
      plusOneGuestName: rsvp.plusOneGuestName,
      partySize: this.partySize(rsvp),
      startsAt: event.startsAt?.toISOString() ?? null,
      venue: event.venue,
      dressCode: event.dressCode,
      passUrl,
      qrImageUrl,
      checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
      eventClosed: this.isEventClosed(event),
    };
  }

  async renderPassQrSvg(passUrl: string): Promise<string> {
    return this.qrRender.renderSvg(passUrl);
  }

  async checkIn(
    eventSlug: string,
    input: { token?: string; rsvpId?: string },
    staffUserId: string,
  ): Promise<OnsiteEventCheckInResult> {
    const rawInput = input.token ?? input.rsvpId ?? "";
    const event = await this.eventRepo.findBySlug(eventSlug);
    if (!event) {
      await this.logAttempt({
        rsvpId: null,
        eventSlug,
        staffUserId,
        result: "INVALID",
        rawInput,
      });
      return { status: "INVALID" };
    }

    if (this.isEventClosed(event)) {
      await this.logAttempt({
        rsvpId: null,
        eventSlug,
        staffUserId,
        result: "EVENT_CLOSED",
        rawInput,
      });
      return { status: "EVENT_CLOSED" };
    }

    let rsvp: OnsiteEventRsvpWithGuest | null = null;
    if (input.rsvpId) {
      rsvp = await this.rsvpRepo.findByIdWithGuest(input.rsvpId);
    } else if (input.token) {
      const plainToken = normaliseCheckInToken(input.token);
      if (!plainToken) {
        await this.logAttempt({
          rsvpId: null,
          eventSlug,
          staffUserId,
          result: "INVALID",
          rawInput,
        });
        return { status: "INVALID" };
      }
      const tokenHash = hashCheckInToken(plainToken);
      rsvp = await this.rsvpRepo.findByTokenHash(tokenHash);
    }

    if (!rsvp) {
      await this.logAttempt({
        rsvpId: null,
        eventSlug,
        staffUserId,
        result: "INVALID",
        rawInput,
      });
      return { status: "INVALID" };
    }

    if (rsvp.eventSlug !== eventSlug) {
      await this.logAttempt({
        rsvpId: rsvp.id,
        eventSlug,
        staffUserId,
        result: "WRONG_EVENT",
        rawInput,
      });
      return { status: "WRONG_EVENT" };
    }

    if (rsvp.checkedInAt) {
      await this.logAttempt({
        rsvpId: rsvp.id,
        eventSlug,
        staffUserId,
        result: "ALREADY_CHECKED_IN",
        rawInput,
      });
      return {
        status: "ALREADY_CHECKED_IN",
        guest: this.mapGuestSummary(event, rsvp),
      };
    }

    if (event.checkInDryRun) {
      await this.logAttempt({
        rsvpId: rsvp.id,
        eventSlug,
        staffUserId,
        result: "DRY_RUN_VALID",
        rawInput,
      });
      return {
        status: "DRY_RUN_VALID",
        guest: this.mapGuestSummary(event, rsvp),
      };
    }

    const checkedIn = await this.rsvpRepo.atomicCheckIn({
      rsvpId: rsvp.id,
      staffUserId,
      partyCount: this.partySize(rsvp),
    });

    if (!checkedIn) {
      const refreshed = await this.rsvpRepo.findByIdWithGuest(rsvp.id);
      if (refreshed?.checkedInAt) {
        await this.logAttempt({
          rsvpId: refreshed.id,
          eventSlug,
          staffUserId,
          result: "ALREADY_CHECKED_IN",
          rawInput,
        });
        return {
          status: "ALREADY_CHECKED_IN",
          guest: this.mapGuestSummary(event, refreshed),
        };
      }
      await this.logAttempt({
        rsvpId: rsvp.id,
        eventSlug,
        staffUserId,
        result: "INVALID",
        rawInput,
      });
      return { status: "INVALID" };
    }

    await this.logAttempt({
      rsvpId: checkedIn.id,
      eventSlug,
      staffUserId,
      result: "VALID",
      rawInput,
    });

    return {
      status: "VALID",
      guest: this.mapGuestSummary(event, checkedIn),
    };
  }

  async searchGuests(
    eventSlug: string,
    query: string,
  ): Promise<OnsiteEventCheckInSearchRow[] | OnsiteEventCheckInServiceError> {
    const event = await this.requireEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;

    const rows = await this.rsvpRepo.searchForCheckIn(eventSlug, query);
    return rows.map((row) => ({
      ...row,
      attendanceSegmentLabel: segmentLabelFor(event, row.attendanceSegment),
    }));
  }

  async recordPassResend(eventSlug: string, rsvpId: string, staffUserId: string): Promise<void> {
    await this.logAttempt({
      rsvpId,
      eventSlug,
      staffUserId,
      result: "PASS_RESENT",
      rawInput: rsvpId,
    });
  }

  async getCheckInStats(
    eventSlug: string,
  ): Promise<
    { total: number; checkedIn: number; checkInDryRun: boolean } | OnsiteEventCheckInServiceError
  > {
    const event = await this.requireEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    const stats = await this.rsvpRepo.countCheckInStats(eventSlug);
    return { ...stats, checkInDryRun: event.checkInDryRun };
  }
}
