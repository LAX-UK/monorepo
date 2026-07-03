import type {
  OnsiteEvent,
  OnsiteEventAdminDetail,
  OnsiteEventListItem,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";
import type { CreateOnsiteEventBody, UpdateOnsiteEventBody } from "@auction/validators";
import type { OnsiteEventRsvpServiceError } from "./onsite-event-service-errors.js";

/**
 * Staff-facing surface consumed by `/admin/event-rsvps/*` routes only: event
 * CRUD, RSVP roster/CSV export, pass resend, and check-in dry-run toggle.
 * Deliberately excludes guest-facing methods (see `IOnsiteEventPublicRsvpService`)
 * so the admin routes never type-depend on unauthenticated guest capabilities.
 */
export interface IOnsiteEventAdminService {
  listAdminEvents(): Promise<OnsiteEventListItem[]>;
  createAdminEvent(body: CreateOnsiteEventBody): Promise<OnsiteEvent | OnsiteEventRsvpServiceError>;
  getAdminEventDetail(
    eventSlug: string,
  ): Promise<OnsiteEventAdminDetail | OnsiteEventRsvpServiceError>;
  updateAdminEvent(
    eventSlug: string,
    body: UpdateOnsiteEventBody,
  ): Promise<OnsiteEvent | OnsiteEventRsvpServiceError>;
  listAdminRsvps(
    eventSlug: string,
  ): Promise<OnsiteEventRsvpAdminRow[] | OnsiteEventRsvpServiceError>;
  exportAdminCsv(eventSlug: string): Promise<string | OnsiteEventRsvpServiceError>;
  resendPass(
    eventSlug: string,
    rsvpId: string,
  ): Promise<
    | { ok: true; rotated: boolean; emailSent: boolean }
    | { ok: false; error: OnsiteEventRsvpServiceError }
  >;
  setCheckInDryRun(
    eventSlug: string,
    enabled: boolean,
  ): Promise<
    { ok: true; checkInDryRun: boolean } | { ok: false; error: OnsiteEventRsvpServiceError }
  >;
}
