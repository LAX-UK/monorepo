import type {
  OnsiteEvent,
  OnsiteEventListItem,
  OnsiteEventPublicListItem,
  OnsiteEventStatus,
} from "@auction/types";

export type CreateOnsiteEventInput = {
  slug: string;
  title: string;
  startsAt?: Date | null;
  rsvpCloseAt?: Date | null;
  segmentOptions: OnsiteEvent["segmentOptions"];
  opsEmail?: string | null;
  micrositeUrl?: string | null;
  venue?: string | null;
  dressCode?: string | null;
  arrivalNote?: string | null;
  status?: OnsiteEventStatus;
  saleId?: string | null;
};

export type UpdateOnsiteEventInput = Partial<{
  title: string;
  startsAt: Date | null;
  rsvpCloseAt: Date | null;
  segmentOptions: OnsiteEvent["segmentOptions"];
  opsEmail: string | null;
  micrositeUrl: string | null;
  venue: string | null;
  dressCode: string | null;
  arrivalNote: string | null;
  status: OnsiteEventStatus;
  saleId: string | null;
}>;

export interface IOnsiteEventRepository {
  findBySlug(slug: string): Promise<OnsiteEvent | null>;
  findBySaleId(saleId: string): Promise<OnsiteEvent | null>;
  listAdminItems(): Promise<OnsiteEventListItem[]>;
  listPublicUpcoming(): Promise<OnsiteEventPublicListItem[]>;
  create(input: CreateOnsiteEventInput): Promise<OnsiteEvent>;
  update(slug: string, input: UpdateOnsiteEventInput): Promise<OnsiteEvent | null>;
  updateCheckInDryRun(slug: string, enabled: boolean): Promise<OnsiteEvent | null>;
}
