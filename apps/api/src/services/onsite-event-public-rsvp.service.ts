import type { IOnsiteEventClientReader, OnsiteEventClientRow } from "@auction/persistence";
import type {
  OnsiteEvent,
  OnsiteEventEmailLookup,
  OnsiteEventExistingRsvp,
  OnsiteEventPublicConfig,
  OnsiteEventPublicListItem,
  OnsiteEventRsvp,
} from "@auction/types";
import type { SubmitOnsiteEventRsvpBody } from "@auction/validators";
import { type AppLogger, createBaseLogger } from "../lib/logger.js";
import { buildPassUrl } from "../lib/onsite-event-check-in-token.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import type { IOnsiteEventPublicRsvpService } from "./interfaces/onsite-event-public-rsvp-service.js";
import type { OnsiteEventRsvpServiceError } from "./interfaces/onsite-event-service-errors.js";
import { OnsiteEventAccessGuard } from "./onsite-event-access-guard.js";
import type { OnsiteEventPassTokenService } from "./onsite-event-pass-token.service.js";
import type { OnsiteEventSaleLinkService } from "./onsite-event-sale-link.service.js";

/**
 * Guest-facing RSVP flow only: public config, upcoming-events hub, email
 * lookup, and RSVP submission. See `OnsiteEventAdminService` for staff CRUD
 * and reporting — the two are split so each depends only on the
 * collaborators its own audience needs (ISP), and so a change to one
 * concern (e.g. CSV export format) can't force a review of the other.
 */
export class OnsiteEventPublicRsvpService implements IOnsiteEventPublicRsvpService {
  private readonly log: AppLogger;
  private readonly guard: OnsiteEventAccessGuard;

  constructor(
    private readonly eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly clientReader: IOnsiteEventClientReader,
    private readonly saleLink: OnsiteEventSaleLinkService,
    private readonly tokenService: OnsiteEventPassTokenService,
    private readonly notifier: IOnsiteEventNotifier | null = null,
    logger?: AppLogger,
  ) {
    this.guard = new OnsiteEventAccessGuard(eventRepo);
    this.log =
      logger ??
      createBaseLogger({ LOG_LEVEL: "fatal", NODE_ENV: "test" }).child({
        module: "onsite-event-public-rsvp",
      });
  }

  private mapPublicConfig(
    event: OnsiteEvent,
    linkedSaleTitle: string | null,
  ): OnsiteEventPublicConfig {
    return {
      slug: event.slug,
      title: event.title,
      segmentOptions: event.segmentOptions,
      rsvpOpen: !this.guard.isEventClosed(event),
      rsvpCloseAt: event.rsvpCloseAt?.toISOString() ?? null,
      micrositeUrl: event.micrositeUrl,
      startsAt: event.startsAt?.toISOString() ?? null,
      venue: event.venue,
      dressCode: event.dressCode,
      arrivalNote: event.arrivalNote,
      opsEmail: event.opsEmail,
      saleId: event.saleId,
      linkedSaleTitle,
      status: event.status === "closed" ? "closed" : "published",
    };
  }

  private mapExisting(rsvp: OnsiteEventRsvp): OnsiteEventExistingRsvp {
    return {
      attendanceSegment: rsvp.attendanceSegment,
      plusOne: rsvp.plusOne,
      plusOneGuestName: rsvp.plusOneGuestName,
      notes: rsvp.notes,
      updatedAt: rsvp.updatedAt.toISOString(),
    };
  }

  private isValidSegment(event: OnsiteEvent, segment: string): boolean {
    return event.segmentOptions.some((option) => option.value === segment);
  }

  async getPublicConfig(
    eventSlug: string,
  ): Promise<OnsiteEventPublicConfig | OnsiteEventRsvpServiceError> {
    const event = await this.guard.requirePublicEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    const linkedSaleTitle = await this.saleLink.resolveLinkedSaleTitle(event.saleId);
    return this.mapPublicConfig(event, linkedSaleTitle);
  }

  async listUpcomingPublicEvents(): Promise<OnsiteEventPublicListItem[]> {
    return this.eventRepo.listPublicUpcoming();
  }

  /**
   * Shared resolution path for `lookupByEmail` and `submitRsvp`: validates the
   * event is open and the client is eligible, in a single pass. Avoids
   * fetching the event, client, and existing RSVP twice per submission.
   */
  private async resolveReadyGuest(
    eventSlug: string,
    email: string,
  ): Promise<
    | {
        ok: true;
        event: OnsiteEvent;
        client: OnsiteEventClientRow;
        existing: OnsiteEventRsvp | null;
      }
    | { ok: false; error: OnsiteEventRsvpServiceError }
    | { ok: false; status: Exclude<OnsiteEventEmailLookup["status"], "ready"> }
  > {
    const event = await this.guard.requirePublishedEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") {
      return { ok: false, error: event };
    }

    if (this.guard.isEventClosed(event)) {
      return { ok: false, status: "event_closed" };
    }

    const client = await this.clientReader.findByEmail(email);
    if (!client) {
      return { ok: false, status: "not_registered" };
    }

    if (client.suspended) {
      return { ok: false, status: "suspended" };
    }

    const existing = await this.rsvpRepo.findByEventAndUser(eventSlug, client.id);
    return { ok: true, event, client, existing };
  }

  async lookupByEmail(
    eventSlug: string,
    email: string,
  ): Promise<OnsiteEventEmailLookup | OnsiteEventRsvpServiceError> {
    const resolved = await this.resolveReadyGuest(eventSlug, email);
    if (!resolved.ok) {
      return "error" in resolved ? resolved.error : { status: resolved.status };
    }

    const { event, client, existing } = resolved;
    const result: OnsiteEventEmailLookup = {
      status: "ready",
      user: { name: client.name, email: client.email },
      segmentOptions: event.segmentOptions,
    };
    if (existing) {
      result.existingRsvp = this.mapExisting(existing);
    }
    return result;
  }

  async submitRsvp(
    eventSlug: string,
    body: SubmitOnsiteEventRsvpBody,
  ): Promise<
    | { ok: true; data: OnsiteEventRsvp; isUpdate: boolean; passUrl: string }
    | { ok: false; error: OnsiteEventRsvpServiceError }
  > {
    const resolved = await this.resolveReadyGuest(eventSlug, body.email);
    if (!resolved.ok) {
      return {
        ok: false,
        error: "error" in resolved ? resolved.error : this.lookupToSubmitError(resolved.status),
      };
    }

    const { event, client, existing } = resolved;

    if (!this.isValidSegment(event, body.attendanceSegment)) {
      return {
        ok: false,
        error: { message: "Invalid attendance segment", status: 400, code: "invalid_segment" },
      };
    }

    const plusOneGuestName = body.plusOne > 0 ? (body.plusOneGuestName?.trim() ?? null) : null;
    const notes = body.notes?.trim() ? body.notes.trim() : null;
    const token = this.tokenService.resolveTokenForRsvp(existing);

    const saved = await this.rsvpRepo.upsert({
      eventSlug,
      userId: client.id,
      attendanceSegment: body.attendanceSegment,
      plusOne: body.plusOne,
      plusOneGuestName,
      notes,
      checkInTokenHash: token.tokenHash,
      checkInTokenIssuedAt: token.issuedAt,
      checkInTokenCiphertext: token.ciphertext,
    });

    const passUrl = buildPassUrl(event.micrositeUrl, token.plainToken);

    if (this.notifier) {
      const payload = {
        userEmail: client.email,
        userName: client.name,
        passUrl,
      };
      void (
        existing
          ? this.notifier.notifyUpdated(event, saved, payload)
          : this.notifier.notifySubmitted(event, saved, payload)
      ).catch((error) => {
        this.log.error(
          {
            eventSlug,
            rsvpId: saved.id,
            isUpdate: existing != null,
            err: error,
          },
          "onsite_event_rsvp_notification_failed",
        );
      });
    }

    return { ok: true, data: saved, isUpdate: existing != null, passUrl };
  }

  private lookupToSubmitError(
    status: Exclude<OnsiteEventEmailLookup["status"], "ready">,
  ): OnsiteEventRsvpServiceError {
    switch (status) {
      case "event_closed":
        return { message: "RSVPs for this event are closed", status: 403, code: "event_closed" };
      case "not_registered":
        return {
          message: "Create a lax.bid account to reserve your spot",
          status: 403,
          code: "not_registered",
        };
      case "suspended":
        return {
          message: "This invitation is for active lax.bid clients",
          status: 403,
          code: "suspended",
        };
    }
  }
}
