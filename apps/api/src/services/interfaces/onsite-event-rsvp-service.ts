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
    | { ok: true; data: OnsiteEventRsvp; isUpdate: boolean; passUrl: string }
    | { ok: false; error: OnsiteEventRsvpServiceError }
  >;
  listAdminEvents(): Promise<OnsiteEventListItem[]>;
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
