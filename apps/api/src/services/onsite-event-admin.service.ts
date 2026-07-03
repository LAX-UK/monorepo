import type {
  OnsiteEvent,
  OnsiteEventAdminDetail,
  OnsiteEventListItem,
  OnsiteEventRsvpAdminRow,
  OnsiteEventSegmentOption,
} from "@auction/types";
import type { CreateOnsiteEventBody, UpdateOnsiteEventBody } from "@auction/validators";
import { type AppLogger, createBaseLogger } from "../lib/logger.js";
import { buildPassUrl } from "../lib/onsite-event-check-in-token.js";
import { onsiteEventRsvpsToCsv } from "../lib/onsite-event-rsvp-csv.js";
import type { IOnsiteEventRsvpRepository } from "../repositories/interfaces/onsite-event-rsvp.repository.js";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { IOnsiteEventAdminService } from "./interfaces/onsite-event-admin-service.js";
import type { IOnsiteEventNotifier } from "./interfaces/onsite-event-notifier.js";
import type { OnsiteEventRsvpServiceError } from "./interfaces/onsite-event-service-errors.js";
import { OnsiteEventAccessGuard } from "./onsite-event-access-guard.js";
import type { OnsiteEventPassTokenService } from "./onsite-event-pass-token.service.js";
import type { OnsiteEventSaleLinkService } from "./onsite-event-sale-link.service.js";

/**
 * Staff-facing event management only: CRUD, RSVP roster/CSV export, pass
 * resend, check-in dry-run toggle. See `OnsiteEventPublicRsvpService` for the
 * guest-facing lookup/submit flow — split so each service depends only on
 * the collaborators its own audience needs (ISP).
 */
export class OnsiteEventAdminService implements IOnsiteEventAdminService {
  private readonly log: AppLogger;
  private readonly guard: OnsiteEventAccessGuard;

  constructor(
    private readonly eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly saleLink: OnsiteEventSaleLinkService,
    private readonly tokenService: OnsiteEventPassTokenService,
    private readonly notifier: IOnsiteEventNotifier | null = null,
    logger?: AppLogger,
  ) {
    this.guard = new OnsiteEventAccessGuard(eventRepo);
    this.log =
      logger ??
      createBaseLogger({ LOG_LEVEL: "fatal", NODE_ENV: "test" }).child({
        module: "onsite-event-admin",
      });
  }

  async listAdminEvents(): Promise<OnsiteEventListItem[]> {
    return this.eventRepo.listAdminItems();
  }

  async getAdminEventDetail(
    eventSlug: string,
  ): Promise<OnsiteEventAdminDetail | OnsiteEventRsvpServiceError> {
    const event = await this.guard.requireAdminEvent(eventSlug);
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
      opsEmail: event.opsEmail,
      checkInDryRun: event.checkInDryRun,
      rsvpCount: stats.total,
      checkedInCount: stats.checkedIn,
      saleId: event.saleId,
    };
  }

  async listAdminRsvps(
    eventSlug: string,
  ): Promise<OnsiteEventRsvpAdminRow[] | OnsiteEventRsvpServiceError> {
    const event = await this.guard.requireAdminEvent(eventSlug);
    if ("status" in event && typeof event.status === "number") return event;
    return this.rsvpRepo.listAdminRows(eventSlug);
  }

  async exportAdminCsv(eventSlug: string): Promise<string | OnsiteEventRsvpServiceError> {
    const event = await this.guard.requireAdminEvent(eventSlug);
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
    const event = await this.guard.requireAdminEvent(eventSlug);
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

    let plainToken: string;
    let pendingRotation: {
      tokenHash: string;
      issuedAt: Date;
      ciphertext: string;
    } | null = null;

    if (rsvp.checkInTokenCiphertext) {
      const decrypted = this.tokenService.decryptStoredToken(rsvp.checkInTokenCiphertext);
      if (!decrypted) {
        return {
          ok: false,
          error: {
            message: "Could not decrypt stored pass token — contact engineering",
            status: 500,
            code: "token_decrypt_failed",
          },
        };
      }
      plainToken = decrypted;
    } else {
      const issued = this.tokenService.issueToken();
      plainToken = issued.plainToken;
      pendingRotation = {
        tokenHash: issued.tokenHash,
        issuedAt: issued.issuedAt,
        ciphertext: issued.ciphertext,
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

  private normalizeSegmentOptions(
    options: CreateOnsiteEventBody["segmentOptions"],
  ): OnsiteEventSegmentOption[] {
    return options.map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.helper ? { helper: option.helper } : {}),
    }));
  }

  async createAdminEvent(
    body: CreateOnsiteEventBody,
  ): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const existing = await this.eventRepo.findBySlug(body.slug);
    if (existing) {
      return {
        message: "An event with this slug already exists",
        status: 409,
        code: "slug_taken",
      };
    }
    const saleError = await this.saleLink.validateLinkedSale(body.saleId ?? null);
    if (saleError) return saleError;

    return this.eventRepo.create({
      slug: body.slug,
      title: body.title,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      rsvpCloseAt: body.rsvpCloseAt ? new Date(body.rsvpCloseAt) : null,
      segmentOptions: this.normalizeSegmentOptions(body.segmentOptions),
      opsEmail: body.opsEmail ?? null,
      micrositeUrl: body.micrositeUrl ?? null,
      venue: body.venue ?? null,
      dressCode: body.dressCode ?? null,
      arrivalNote: body.arrivalNote ?? null,
      status: body.status,
      saleId: body.saleId ?? null,
    });
  }

  async updateAdminEvent(
    eventSlug: string,
    body: UpdateOnsiteEventBody,
  ): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const existing = await this.eventRepo.findBySlug(eventSlug);
    if (!existing) return this.guard.notFound();

    if (body.saleId !== undefined) {
      const saleError = await this.saleLink.validateLinkedSale(body.saleId, eventSlug);
      if (saleError) return saleError;
    }

    const updated = await this.eventRepo.update(eventSlug, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.startsAt !== undefined
        ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
        : {}),
      ...(body.rsvpCloseAt !== undefined
        ? { rsvpCloseAt: body.rsvpCloseAt ? new Date(body.rsvpCloseAt) : null }
        : {}),
      ...(body.segmentOptions !== undefined
        ? { segmentOptions: this.normalizeSegmentOptions(body.segmentOptions) }
        : {}),
      ...(body.opsEmail !== undefined ? { opsEmail: body.opsEmail } : {}),
      ...(body.micrositeUrl !== undefined ? { micrositeUrl: body.micrositeUrl } : {}),
      ...(body.venue !== undefined ? { venue: body.venue } : {}),
      ...(body.dressCode !== undefined ? { dressCode: body.dressCode } : {}),
      ...(body.arrivalNote !== undefined ? { arrivalNote: body.arrivalNote } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.saleId !== undefined ? { saleId: body.saleId } : {}),
    });
    if (!updated) return this.guard.notFound();
    return updated;
  }
}
