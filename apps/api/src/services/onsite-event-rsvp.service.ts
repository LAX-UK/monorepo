import type {
  OnsiteEvent,
  OnsiteEventAdminDetail,
  OnsiteEventEmailLookup,
  OnsiteEventExistingRsvp,
  OnsiteEventListItem,
  OnsiteEventPublicConfig,
  OnsiteEventRsvp,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";
import type { SubmitOnsiteEventRsvpBody } from "@auction/validators";
import { decryptCheckInToken, encryptCheckInToken } from "../lib/check-in-token-ciphertext.js";
import { type AppLogger, createBaseLogger } from "../lib/logger.js";
import { buildPassUrl, issueCheckInToken } from "../lib/onsite-event-check-in-token.js";
import { onsiteEventRsvpsToCsv } from "../lib/onsite-event-rsvp-csv.js";
import type { IOnsiteEventClientReader } from "../repositories/interfaces/onsite-event-client.reader.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import type {
  IOnsiteEventRsvpService,
  OnsiteEventRsvpServiceError,
} from "./interfaces/onsite-event-rsvp-service.js";

export class OnsiteEventRsvpService implements IOnsiteEventRsvpService {
  private readonly log: AppLogger;

  constructor(
    private readonly eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly clientReader: IOnsiteEventClientReader,
    private readonly notifier: IOnsiteEventNotifier | null = null,
    private readonly tokenCipherSecret: string | null = null,
    logger?: AppLogger,
  ) {
    this.log =
      logger ??
      createBaseLogger({ LOG_LEVEL: "fatal", NODE_ENV: "test" }).child({
        module: "onsite-event-rsvp",
      });
  }

  private notFound(): OnsiteEventRsvpServiceError {
    return { message: "Event not found", status: 404, code: "event_not_found" };
  }

  private async requirePublishedEvent(
    slug: string,
  ): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event || event.status !== "published") {
      return this.notFound();
    }
    return event;
  }

  private async requireAdminEvent(
    slug: string,
  ): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event) return this.notFound();
    return event;
  }

  private isEventClosed(event: OnsiteEvent): boolean {
    if (event.status === "closed") return true;
    const closeAt = event.rsvpCloseAt;
    if (!closeAt) return false;
    return Date.now() >= closeAt.getTime();
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
    const event = await this.requirePublishedEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    return {
      slug: event.slug,
      title: event.title,
      segmentOptions: event.segmentOptions,
      rsvpOpen: !this.isEventClosed(event),
      rsvpCloseAt: event.rsvpCloseAt?.toISOString() ?? null,
      micrositeUrl: event.micrositeUrl,
      startsAt: event.startsAt?.toISOString() ?? null,
      venue: event.venue,
      dressCode: event.dressCode,
      arrivalNote: event.arrivalNote,
    };
  }

  async lookupByEmail(
    eventSlug: string,
    email: string,
  ): Promise<OnsiteEventEmailLookup | OnsiteEventRsvpServiceError> {
    const event = await this.requirePublishedEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;

    if (this.isEventClosed(event)) {
      return { status: "event_closed" };
    }

    const client = await this.clientReader.findByEmail(email);
    if (!client) {
      return { status: "not_registered" };
    }

    if (client.suspended) {
      return { status: "suspended" };
    }

    const existing = await this.rsvpRepo.findByEventAndUser(eventSlug, client.id);
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
    const event = await this.requirePublishedEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") {
      return { ok: false, error: event };
    }

    if (this.isEventClosed(event)) {
      return {
        ok: false,
        error: { message: "RSVPs for this event are closed", status: 403, code: "event_closed" },
      };
    }

    if (!this.isValidSegment(event, body.attendanceSegment)) {
      return {
        ok: false,
        error: { message: "Invalid attendance segment", status: 400, code: "invalid_segment" },
      };
    }

    const lookup = await this.lookupByEmail(eventSlug, body.email);
    if ("status" in lookup && typeof lookup.status === "number") {
      return { ok: false, error: lookup };
    }
    if (lookup.status !== "ready") {
      return { ok: false, error: this.lookupToSubmitError(lookup.status) };
    }

    const client = await this.clientReader.findByEmail(body.email);
    if (!client) {
      return {
        ok: false,
        error: {
          message: "Create a lax.bid account to reserve your spot",
          status: 403,
          code: "not_registered",
        },
      };
    }

    const existing = await this.rsvpRepo.findByEventAndUser(eventSlug, client.id);
    const plusOneGuestName = body.plusOne > 0 ? (body.plusOneGuestName?.trim() ?? null) : null;
    const notes = body.notes?.trim() ? body.notes.trim() : null;
    const token = this.resolveCheckInToken(existing);

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
        userEmail: lookup.user.email,
        userName: lookup.user.name,
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

  async listAdminEvents(): Promise<OnsiteEventListItem[]> {
    return this.eventRepo.listAdminItems();
  }

  async getAdminEventDetail(
    eventSlug: string,
  ): Promise<OnsiteEventAdminDetail | OnsiteEventRsvpServiceError> {
    const event = await this.requireAdminEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;

    const stats = await this.rsvpRepo.countCheckInStats(eventSlug);
    return {
      slug: event.slug,
      title: event.title,
      status: event.status,
      startsAt: event.startsAt?.toISOString() ?? null,
      rsvpCloseAt: event.rsvpCloseAt?.toISOString() ?? null,
      segmentOptions: event.segmentOptions,
      micrositeUrl: event.micrositeUrl,
      venue: event.venue,
      dressCode: event.dressCode,
      arrivalNote: event.arrivalNote,
      checkInDryRun: event.checkInDryRun,
      rsvpCount: stats.total,
      checkedInCount: stats.checkedIn,
    };
  }

  async listAdminRsvps(
    eventSlug: string,
  ): Promise<OnsiteEventRsvpAdminRow[] | OnsiteEventRsvpServiceError> {
    const event = await this.requireAdminEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    return this.rsvpRepo.listAdminRows(eventSlug);
  }

  async exportAdminCsv(eventSlug: string): Promise<string | OnsiteEventRsvpServiceError> {
    const event = await this.requireAdminEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    const rows = await this.rsvpRepo.listAdminRows(eventSlug);
    return onsiteEventRsvpsToCsv(event, rows);
  }

  async resendPass(
    eventSlug: string,
    rsvpId: string,
  ): Promise<
    | { ok: true; rotated: boolean; emailSent: true }
    | { ok: false; error: OnsiteEventRsvpServiceError }
  > {
    const event = await this.requireAdminEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") {
      return { ok: false, error: event };
    }

    const rsvp = await this.rsvpRepo.findByIdWithGuest(rsvpId);
    if (!rsvp || rsvp.eventSlug !== eventSlug) {
      return {
        ok: false,
        error: { message: "RSVP not found", status: 404, code: "rsvp_not_found" },
      };
    }

    if (!this.notifier) {
      return {
        ok: false,
        error: {
          message: "Pass email is not configured",
          status: 503,
          code: "pass_email_not_configured",
        },
      };
    }

    let plainToken: string | null = null;
    let pendingRotation: {
      tokenHash: string;
      issuedAt: Date;
      ciphertext: string;
    } | null = null;

    if (rsvp.checkInTokenCiphertext) {
      plainToken = this.decryptStoredToken(rsvp.checkInTokenCiphertext);
      if (!plainToken) {
        return {
          ok: false,
          error: {
            message: "Could not decrypt stored pass token — contact engineering",
            status: 500,
            code: "token_decrypt_failed",
          },
        };
      }
    } else {
      const issued = issueCheckInToken();
      plainToken = issued.plainToken;
      pendingRotation = {
        tokenHash: issued.tokenHash,
        issuedAt: new Date(),
        ciphertext: this.encryptToken(issued.plainToken),
      };
    }

    let rotated = false;
    if (pendingRotation) {
      const updated = await this.rsvpRepo.updateCheckInToken(rsvpId, {
        checkInTokenHash: pendingRotation.tokenHash,
        checkInTokenIssuedAt: pendingRotation.issuedAt,
        checkInTokenCiphertext: pendingRotation.ciphertext,
      });
      if (!updated) {
        return {
          ok: false,
          error: {
            message: "Could not refresh pass token",
            status: 500,
            code: "token_update_failed",
          },
        };
      }
      rotated = true;
    }

    const passUrl = buildPassUrl(event.micrositeUrl, plainToken);
    try {
      await this.notifier.notifyResent(event, rsvp, {
        userEmail: rsvp.guestEmail,
        userName: rsvp.guestName,
        passUrl,
      });
    } catch (error) {
      this.log.error(
        {
          eventSlug,
          rsvpId,
          rotated,
          err: error,
        },
        rotated ? "onsite_event_pass_token_saved_email_failed" : "onsite_event_pass_email_failed",
      );
      return {
        ok: false,
        error: {
          message: rotated
            ? "A new pass link was saved but the email could not be sent. Try resending again — the guest's previous link no longer works."
            : "Pass email could not be sent",
          status: 502,
          code: rotated ? "pass_token_saved_email_failed" : "pass_email_failed",
        },
      };
    }

    return { ok: true, rotated, emailSent: true };
  }

  async setCheckInDryRun(
    eventSlug: string,
    enabled: boolean,
  ): Promise<
    { ok: true; checkInDryRun: boolean } | { ok: false; error: OnsiteEventRsvpServiceError }
  > {
    const updated = await this.eventRepo.updateCheckInDryRun(eventSlug, enabled);
    if (!updated) {
      return {
        ok: false,
        error: { message: "Event not found", status: 404, code: "event_not_found" },
      };
    }
    return { ok: true, checkInDryRun: updated.checkInDryRun };
  }

  private resolveCheckInToken(existing: OnsiteEventRsvp | null): {
    plainToken: string;
    tokenHash: string;
    issuedAt: Date;
    ciphertext: string;
  } {
    if (existing?.checkInTokenCiphertext && existing.checkInTokenHash) {
      const plainToken = this.decryptStoredToken(existing.checkInTokenCiphertext);
      if (plainToken) {
        return {
          plainToken,
          tokenHash: existing.checkInTokenHash,
          issuedAt: existing.checkInTokenIssuedAt ?? new Date(),
          ciphertext: existing.checkInTokenCiphertext,
        };
      }
    }

    const issued = issueCheckInToken();
    return {
      plainToken: issued.plainToken,
      tokenHash: issued.tokenHash,
      issuedAt: new Date(),
      ciphertext: this.encryptToken(issued.plainToken),
    };
  }

  private encryptToken(plainToken: string): string {
    if (!this.tokenCipherSecret) {
      throw new Error("Check-in token encryption secret is not configured");
    }
    return encryptCheckInToken(plainToken, this.tokenCipherSecret);
  }

  private decryptStoredToken(ciphertext: string | null): string | null {
    if (!ciphertext || !this.tokenCipherSecret) return null;
    return decryptCheckInToken(ciphertext, this.tokenCipherSecret);
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
