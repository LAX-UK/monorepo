import type {
  CollectionBookingOffer,
  DeliveryQuoteAction,
  PaySeveralPlan,
  PurchaseDeliveryStage,
  PurchaseInvoiceStatus,
  PurchasePaymentRole,
} from "@auction/domain";
import type {
  AccountRegistrationRow,
  DeliveryQuoteRow,
  RecordPerson,
} from "@auction/persistence/interfaces";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type OrganisationBuyingErrorCode =
  | "insufficient_entity_role"
  | "purchase_not_found"
  | "quote_step_not_allowed"
  | "quote_wrong_actor"
  | "quote_changed"
  | "pay_several_empty"
  | "pay_several_too_many"
  | "pay_several_duplicate"
  | "pay_several_nothing_payable"
  | "pay_several_mixed_currency";

export type OrganisationBuyingError = {
  code: OrganisationBuyingErrorCode;
  status: 400 | 403 | 404 | 409;
  message: string;
};

export type BuyingResult<T> = Promise<Result<T, OrganisationBuyingError>>;

/** The sales the acting account is registered for (the Bids "Sales" view). */
export interface IAccountRegistrationsService {
  list(actor: OrganisationMemberActor): BuyingResult<AccountRegistrationRow[]>;
}

/** A courier quote as a purchase row shows it, with the steps open to this member. */
export type PurchaseQuoteView = Omit<DeliveryQuoteRow, "lotId" | "buyerLegalEntityId"> & {
  actions: DeliveryQuoteAction[];
};

/** One row of the Purchases list. */
export type AccountPurchaseView = {
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  sale: { id: string; title: string | null } | null;
  hammerPrice: string;
  wonBy: RecordPerson | null;
  wonAt: Date;
  /** How the member stands to paying it: the payer, the winner who is told, or neither. */
  paymentRole: PurchasePaymentRole;
  invoice: {
    status: PurchaseInvoiceStatus;
    dueAt: Date | null;
    paymentId: string | null;
    /** The invoice total; `null` until an invoice is raised. */
    totalDue: string | null;
  };
  delivery: {
    stage: PurchaseDeliveryStage;
    method: "collection" | "shipping" | null;
    carrier: string | null;
    trackingNumber: string | null;
    collectedBy: string | null;
    collectedAt: Date | null;
    quote: PurchaseQuoteView | null;
  };
};

export type PurchasesPage = { items: AccountPurchaseView[]; nextOffset: number | null };

export interface IAccountPurchasesService {
  list(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number },
  ): BuyingResult<PurchasesPage>;
  /** Which of the picked invoices one payment would settle, with the total. */
  planPaySeveral(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralPlan>;
  /** The member's purchases as a CSV document for reconciling. */
  exportCsv(actor: OrganisationMemberActor): BuyingResult<string>;
}

/** The buyer's side of a courier quote. Only the account's payers take these steps. */
export interface IDeliveryQuoteService {
  request(
    actor: OrganisationMemberActor,
    lotId: string,
    destination: string,
  ): BuyingResult<PurchaseQuoteView>;
  accept(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseQuoteView>;
  withdraw(actor: OrganisationMemberActor, lotId: string): BuyingResult<PurchaseQuoteView>;
}

/** The saleroom team's side: pricing a requested quote, which tells the buyer it is ready. */
export interface IStaffDeliveryQuoteService {
  quote(input: {
    staffUserId: string;
    lotId: string;
    amount: string;
    note: string | null;
  }): BuyingResult<DeliveryQuoteRow>;
}

/** How to book a collection for a purchase: email for now, self-serve once switched on. */
export interface ICollectionBookingService {
  offer(actor: OrganisationMemberActor, lotId: string): BuyingResult<CollectionBookingOffer>;
}
