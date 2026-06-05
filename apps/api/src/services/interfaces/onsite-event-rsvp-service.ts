import type {
  OnsiteEventEmailLookup,
  OnsiteEventListItem,
  OnsiteEventPublicConfig,
  OnsiteEventRsvp,
  OnsiteEventRsvpAdminRow,
} from "@auction/types";
import type { SubmitOnsiteEventRsvpBody } from "@auction/validators";

export type OnsiteEventRsvpServiceError = {
  message: string;
  status: number;
  code?: string;
};

export interface IOnsiteEventRsvpService {
  getPublicConfig(
    eventSlug: string,
  ): Promise<OnsiteEventPublicConfig | OnsiteEventRsvpServiceError>;
  lookupByEmail(
    eventSlug: string,
    email: string,
  ): Promise<OnsiteEventEmailLookup | OnsiteEventRsvpServiceError>;
  submitRsvp(
    eventSlug: string,
    body: SubmitOnsiteEventRsvpBody,
  ): Promise<
    | { ok: true; data: OnsiteEventRsvp; isUpdate: boolean }
    | { ok: false; error: OnsiteEventRsvpServiceError }
  >;
  listAdminEvents(): Promise<OnsiteEventListItem[]>;
  listAdminRsvps(
    eventSlug: string,
  ): Promise<OnsiteEventRsvpAdminRow[] | OnsiteEventRsvpServiceError>;
  exportAdminCsv(eventSlug: string): Promise<string | OnsiteEventRsvpServiceError>;
}
