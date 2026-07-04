import type { IOnsiteEventRepository } from "@auction/persistence/interfaces";
import type { OnsiteEvent } from "@auction/types";
import type { OnsiteEventRsvpServiceError } from "./interfaces/onsite-event-service-errors.js";

/**
 * Shared "what counts as a visible/eligible event for this audience" guards,
 * used by both the public and admin onsite-event services so event-status
 * rules live in exactly one place instead of duplicated per service.
 */
export class OnsiteEventAccessGuard {
  constructor(private readonly eventRepo: IOnsiteEventRepository) {}

  notFound(): OnsiteEventRsvpServiceError {
    return { message: "Event not found", status: 404, code: "event_not_found" };
  }

  /** Any event visible outside admin — i.e. not a draft. Covers published + closed (archive). */
  async requirePublicEvent(slug: string): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event || event.status === "draft") {
      return this.notFound();
    }
    return event;
  }

  /** Guest RSVP lookup/submit only operate on published (not draft, not closed) events. */
  async requirePublishedEvent(slug: string): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const event = await this.requirePublicEvent(slug);
    if ("status" in event && typeof event.status === "number") return event;
    if (event.status !== "published") {
      return this.notFound();
    }
    return event;
  }

  /** Admin can see events of any status, including drafts. */
  async requireAdminEvent(slug: string): Promise<OnsiteEvent | OnsiteEventRsvpServiceError> {
    const event = await this.eventRepo.findBySlug(slug);
    if (!event) return this.notFound();
    return event;
  }

  isEventClosed(event: OnsiteEvent): boolean {
    if (event.status === "closed") return true;
    const closeAt = event.rsvpCloseAt;
    if (!closeAt) return false;
    return Date.now() >= closeAt.getTime();
  }
}
