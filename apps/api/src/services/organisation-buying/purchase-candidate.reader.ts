import type { PaySeveralCandidate } from "@auction/domain";
import type {
  AccountPurchaseFactsRow,
  IAccountPurchaseFactsReader,
  IPaySeveralInvoiceFlagsReader,
  PaySeveralInvoiceFlags,
} from "@auction/persistence/interfaces";
import type { AccountPurchaseView } from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { paySeveralCandidate, purchaseView } from "./purchase-view.js";

/** Every invoice is raised in pounds sterling. */
export const INVOICE_CURRENCY = "GBP";

/** A picked lot as read from the account: the row, how the member sees it, and its flags. */
export type PurchaseEntry = {
  lotId: string;
  /** `null` when the lot is not one of the member's purchases in this account. */
  row: AccountPurchaseFactsRow | null;
  view: AccountPurchaseView | null;
  flags: PaySeveralInvoiceFlags;
};

export type PurchaseCandidates = {
  /** In the order picked. */
  entries: PurchaseEntry[];
  picks: PaySeveralCandidate[];
  /** The winner of each lot found, for checking them as well as the payer. */
  winners: Map<string, string | null>;
};

export type PurchaseCandidateReaderDeps = {
  reader: IAccountPurchaseFactsReader;
  flags: IPaySeveralInvoiceFlagsReader;
  now: () => Date;
};

const NO_FLAGS: PaySeveralInvoiceFlags = { heldForReview: false, inPaymentInProgress: false };

/**
 * Reads the lots picked for a payment, the one way both the pay plan and "Pay several" see them,
 * so what the page shows and what is paid are worked out from the same facts.
 */
export class PurchaseCandidateReader {
  constructor(private readonly deps: PurchaseCandidateReaderDeps) {}

  async read(
    actor: OrganisationMemberActor,
    ownOnly: boolean,
    lotIds: readonly string[],
  ): Promise<PurchaseCandidates> {
    const rows = lotIds.length
      ? await this.deps.reader.list({
          legalEntityId: actor.legalEntityId,
          memberUserId: ownOnly ? actor.userId : null,
          lotIds,
          limit: lotIds.length,
          offset: 0,
        })
      : [];
    const now = this.deps.now();
    const views = rows.map((row) => purchaseView(row, actor, now));
    const winners = new Map(rows.map((row) => [row.lotId, row.wonBy?.userId ?? null]));
    const paymentIds = views.flatMap((v) => (v.invoice.paymentId ? [v.invoice.paymentId] : []));
    const flags = await this.deps.flags.flagsFor(paymentIds);
    const rowByLot = new Map(rows.map((row) => [row.lotId, row]));
    const viewByLot = new Map(views.map((view) => [view.lotId, view]));

    const entries = lotIds.map<PurchaseEntry>((lotId) => {
      const view = viewByLot.get(lotId) ?? null;
      const paymentId = view?.invoice.paymentId;
      return {
        lotId,
        row: rowByLot.get(lotId) ?? null,
        view,
        flags: (paymentId ? flags.get(paymentId) : undefined) ?? NO_FLAGS,
      };
    });
    // A pick outside what the member follows in this account is treated as another account's.
    const picks = entries.map<PaySeveralCandidate>((entry) =>
      entry.view
        ? paySeveralCandidate(entry.view, actor.legalEntityId, INVOICE_CURRENCY, entry.flags)
        : {
            lotId: entry.lotId,
            paymentId: null,
            buyerAccountId: "",
            invoice: "not_invoiced",
            payerMayPay: false,
            totalDue: null,
            currency: INVOICE_CURRENCY,
            heldForReview: false,
            inPaymentInProgress: false,
          },
    );
    return { entries, picks, winners };
  }
}
