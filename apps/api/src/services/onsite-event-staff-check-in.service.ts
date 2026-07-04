import type { IOnsiteEventCheckInLogRepository } from "@auction/persistence";
import type { IOnsiteEventRsvpRepository, OnsiteEventRsvpWithGuest } from "@auction/persistence";
import type { IOnsiteEventRepository } from "@auction/persistence";
import type { OnsiteEvent } from "@auction/types";
import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";
import { type AppLogger, createBaseLogger } from "../lib/logger.js";
import {
  hashCheckInInput,
  hashCheckInToken,
  normaliseCheckInToken,
} from "../lib/onsite-event-check-in-token.js";
import { mapGuestSummary, partySize } from "../lib/onsite-event-check-in.mapper.js";
import { segmentLabelFor } from "../lib/onsite-event.mapper.js";
import type { OnsiteEventCheckInServiceError } from "./interfaces/onsite-event-service-errors.js";
import type { IOnsiteEventStaffCheckInService } from "./interfaces/onsite-event-staff-check-in-service.js";
import { OnsiteEventAccessGuard } from "./onsite-event-access-guard.js";

export class OnsiteEventStaffCheckInService implements IOnsiteEventStaffCheckInService {
  private readonly log: AppLogger;
  private readonly guard: OnsiteEventAccessGuard;

  constructor(
    eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly checkInLogRepo: IOnsiteEventCheckInLogRepository,
    logger?: AppLogger,
  ) {
    this.guard = new OnsiteEventAccessGuard(eventRepo);
    this.log =
      logger ??
      createBaseLogger({ LOG_LEVEL: "fatal", NODE_ENV: "test" }).child({
        module: "onsite-event-staff-check-in",
      });
  }

  private isEventClosedForCheckIn(event: OnsiteEvent): boolean {
    return event.status === "closed";
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

  async checkIn(
    eventSlug: string,
    input: { token?: string; rsvpId?: string },
    staffUserId: string,
  ): Promise<OnsiteEventCheckInResult> {
    const rawInput = input.token ?? input.rsvpId ?? "";
    const eventResult = await this.guard.requireAdminEvent(eventSlug);
    if ("message" in eventResult) {
      await this.logAttempt({
        rsvpId: null,
        eventSlug,
        staffUserId,
        result: "INVALID",
        rawInput,
      });
      return { status: "INVALID" };
    }
    const event = eventResult;

    if (this.isEventClosedForCheckIn(event)) {
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
        guest: mapGuestSummary(event, rsvp),
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
        guest: mapGuestSummary(event, rsvp),
      };
    }

    const checkedIn = await this.rsvpRepo.atomicCheckIn({
      rsvpId: rsvp.id,
      staffUserId,
      partyCount: partySize(rsvp),
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
          guest: mapGuestSummary(event, refreshed),
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
      guest: mapGuestSummary(event, checkedIn),
    };
  }

  async searchGuests(
    eventSlug: string,
    query: string,
  ): Promise<OnsiteEventCheckInSearchRow[] | OnsiteEventCheckInServiceError> {
    const event = await this.guard.requireAdminEvent(eventSlug);
    if ("message" in event) return event;

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
    const event = await this.guard.requireAdminEvent(eventSlug);
    if ("message" in event) return event;
    const stats = await this.rsvpRepo.countCheckInStats(eventSlug);
    return { ...stats, checkInDryRun: event.checkInDryRun };
  }
}
