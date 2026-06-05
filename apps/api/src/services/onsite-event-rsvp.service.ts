import type {
  OnsiteEvent,
  OnsiteEventEmailLookup,
  OnsiteEventExistingRsvp,
  OnsiteEventListItem,
  OnsiteEventPublicConfig,
  OnsiteEventRsvp,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";
import type { SubmitOnsiteEventRsvpBody } from "@auction/validators";
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
  constructor(
    private readonly eventRepo: IOnsiteEventRepository,
    private readonly rsvpRepo: IOnsiteEventRsvpRepository,
    private readonly clientReader: IOnsiteEventClientReader,
    private readonly notifier: IOnsiteEventNotifier | null = null,
  ) {}

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
    | { ok: true; data: OnsiteEventRsvp; isUpdate: boolean }
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

    const saved = await this.rsvpRepo.upsert({
      eventSlug,
      userId: client.id,
      attendanceSegment: body.attendanceSegment,
      plusOne: body.plusOne,
      plusOneGuestName,
      notes,
    });

    if (this.notifier) {
      const payload = { userEmail: lookup.user.email, userName: lookup.user.name };
      void (
        existing
          ? this.notifier.notifyUpdated(event, saved, payload)
          : this.notifier.notifySubmitted(event, saved, payload)
      ).catch(() => undefined);
    }

    return { ok: true, data: saved, isUpdate: existing != null };
  }

  async listAdminEvents(): Promise<OnsiteEventListItem[]> {
    return this.eventRepo.listAdminItems();
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
