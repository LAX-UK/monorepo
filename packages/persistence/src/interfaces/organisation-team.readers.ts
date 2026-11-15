import type { ActivityEventRecord, ActivityEventType } from "@auction/domain";

/** The invoice address, complete. */
export type InvoiceAddress = {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
};

/** What an organisation's finance team keeps for its invoices. */
export type InvoiceDetails = {
  billingEmail: string | null;
  address: InvoiceAddress | null;
  poReference: string | null;
  updatedAt: Date | null;
};

/** Where an organisation's address came from: its registration, or added for deliveries. */
export type OrganisationAddressKind = "registered" | "delivery";

export type OrganisationAddress = InvoiceAddress & { id: string; kind: OrganisationAddressKind };

/** The addresses a purchase can be delivered to for an organisation. */
export interface IOrganisationAddressRepository {
  /** The registered address (when it has one), then the delivery addresses, oldest first. */
  list(legalEntityId: string): Promise<OrganisationAddress[]>;
  /** Adds a delivery address and returns it. */
  addDelivery(legalEntityId: string, address: InvoiceAddress): Promise<OrganisationAddress>;
}

export interface IInvoiceDetailsReader {
  /** The organisation's details, or `null` when none were ever saved. */
  find(legalEntityId: string): Promise<InvoiceDetails | null>;
}

export interface IInvoiceDetailsRepository extends IInvoiceDetailsReader {
  /** Replaces the whole set and returns the saved details. */
  save(
    legalEntityId: string,
    details: Omit<InvoiceDetails, "updatedAt">,
    updatedByUserId: string,
  ): Promise<InvoiceDetails>;
}

export type ActivityListFilter = {
  legalEntityId: string;
  eventTypes: readonly ActivityEventType[];
  since: Date;
  until: Date;
  /** Entries done by, or about, this person. */
  personUserId?: string | undefined;
  /** Entries older than this id (the previous page's last), newest first. */
  beforeId?: number | undefined;
  limit: number;
};

/** A person named in Activity, and whether they ever belonged to the organisation. */
export type ActivityPerson = { name: string; wasMember: boolean };

/**
 * The organisation's history from domain events: events recorded while acting for it, and events
 * about it, of the given types only.
 */
export interface IOrganisationActivityReader {
  list(filter: ActivityListFilter): Promise<ActivityEventRecord[]>;
  people(legalEntityId: string, userIds: readonly string[]): Promise<Map<string, ActivityPerson>>;
}
