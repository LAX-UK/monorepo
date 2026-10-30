import type { DeliveryQuoteStatus, FulfilmentFacts } from "@auction/domain";
import type { LegalEntityKind } from "@auction/types";

/** A member named on a record: who registered, placed a bid or won a lot. */
export type RecordPerson = {
  userId: string;
  /** The person's name from the identity directory, or `null` when it is not known. */
  name: string | null;
};

/** One sale the account is registered for, with who registered it. */
export type AccountRegistrationRow = {
  id: string;
  saleId: string;
  saleTitle: string;
  saleStartsAt: Date;
  saleEndsAt: Date;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  paddleNumber: number | null;
  bidLimit: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  registeredBy: RecordPerson;
};

/** Whose records a read covers: the whole account, or one member's own. */
export type AccountRecordsScope = {
  legalEntityId: string;
  /** Narrow to records this member made (registered, bid, won); `null` reads everyone's. */
  memberUserId: string | null;
};

/** Sales the acting account is registered for, newest sale first. */
export interface IAccountRegistrationsReader {
  list(scope: AccountRecordsScope): Promise<AccountRegistrationRow[]>;
}

/** The names of the people behind a set of records, for "placed by" and "won by". */
export interface IRecordPeopleReader {
  namesFor(userIds: readonly string[]): Promise<Map<string, string>>;
}

/** A courier quote as the purchase list and the quote steps read it. */
export type DeliveryQuoteRow = {
  id: string;
  lotId: string;
  buyerLegalEntityId: string;
  status: DeliveryQuoteStatus;
  destination: string;
  amount: string | null;
  currency: string;
  quoteNote: string | null;
  requestedByUserId: string | null;
  requestedAt: Date;
  quotedAt: Date | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
};

/** One lot won for the account, with everything its row and export need. */
export type AccountPurchaseFactsRow = {
  lotId: string;
  /** Whether the lot was won for a person's own account or an organisation (who may pay). */
  buyerAccountKind: LegalEntityKind;
  lotTitle: string;
  lotNumber: number | null;
  saleId: string | null;
  saleTitle: string | null;
  /** The hammer price (the winning bid). */
  hammerPrice: string;
  wonBy: RecordPerson | null;
  wonAt: Date;
  /** The latest payment for the lot and account; `null` while no invoice is raised. */
  payment: {
    id: string;
    status:
      | "pending"
      | "authorized"
      | "captured"
      | "refunded"
      | "requires_manual_review"
      | "cancelled";
    amount: string;
    raisedAt: Date;
  } | null;
  fulfilment:
    | (FulfilmentFacts & {
        carrier: string | null;
        trackingNumber: string | null;
        collectedBy: string | null;
        collectedAt: Date | null;
      })
    | null;
  /** The live quote, or the latest withdrawn one; `null` when none was asked for. */
  quote: DeliveryQuoteRow | null;
};

/** Lots won for the account, newest first, optionally only some lots. */
export interface IAccountPurchaseFactsReader {
  list(
    scope: AccountRecordsScope & { lotIds?: readonly string[]; limit: number; offset: number },
  ): Promise<AccountPurchaseFactsRow[]>;
}

export type DeliveryQuoteWrite = {
  status: DeliveryQuoteStatus;
  actorUserId: string;
  amount?: string;
  quoteNote?: string | null;
};

/** Courier quotes. Every change names the status it moves from, so a stale step changes nothing. */
export interface IDeliveryQuoteRepository {
  /** The live quote (requested, quoted or accepted) for a lot and account, else the latest one. */
  findLatest(lotId: string, buyerLegalEntityId: string): Promise<DeliveryQuoteRow | null>;
  /** Opens a request; `null` when a live quote already exists. */
  insertRequested(input: {
    lotId: string;
    buyerLegalEntityId: string;
    destination: string;
    currency: string;
    requestedByUserId: string;
  }): Promise<DeliveryQuoteRow | null>;
  /** Moves a quote from `from`; `null` when it is no longer in `from`. */
  transition(
    id: string,
    from: DeliveryQuoteStatus,
    write: DeliveryQuoteWrite,
  ): Promise<DeliveryQuoteRow | null>;
}
