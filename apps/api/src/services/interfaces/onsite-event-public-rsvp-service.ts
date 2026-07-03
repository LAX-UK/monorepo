import type {
  OnsiteEventEmailLookup,
  OnsiteEventPublicConfig,
  OnsiteEventPublicListItem,
  OnsiteEventRsvp,
} from "@auction/types";
import type { SubmitOnsiteEventRsvpBody } from "@auction/validators";
import type { OnsiteEventRsvpServiceError } from "./onsite-event-service-errors.js";

/**
 * Guest-facing surface consumed by the public `/events/*` routes only:
 * upcoming-events hub, per-event public config, email lookup, and RSVP
 * submission. Deliberately excludes admin CRUD/reporting methods (see
 * `IOnsiteEventAdminService`) so the guest routes never type-depend on
 * staff-only capabilities.
 */
export interface IOnsiteEventPublicRsvpService {
  getPublicConfig(
    eventSlug: string,
  ): Promise<OnsiteEventPublicConfig | OnsiteEventRsvpServiceError>;
  listUpcomingPublicEvents(): Promise<OnsiteEventPublicListItem[]>;
  lookupByEmail(
    eventSlug: string,
    email: string,
  ): Promise<OnsiteEventEmailLookup | OnsiteEventRsvpServiceError>;
  submitRsvp(
    eventSlug: string,
    body: SubmitOnsiteEventRsvpBody,
  ): Promise<
    | { ok: true; data: OnsiteEventRsvp; isUpdate: boolean; passUrl: string }
    | { ok: false; error: OnsiteEventRsvpServiceError }
  >;
}
