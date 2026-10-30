import {
  type PaySeveralCandidate,
  type PaySeveralPlan,
  accountPurchaseScope,
  planPaySeveral,
} from "@auction/domain";
import { type ExportColumn, formatCsvDocument } from "@auction/exports";
import type {
  AccountRecordsScope,
  IAccountPurchaseFactsReader,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import type {
  AccountPurchaseView,
  BuyingResult,
  IAccountPurchasesService,
  PurchasesPage,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { buyingError, entityActorOf, paySeveralCandidate, purchaseView } from "./purchase-view.js";

/** Every invoice is raised in pounds sterling. */
const INVOICE_CURRENCY = "GBP";
/** The most rows one export carries; a larger history is exported a year at a time. */
const EXPORT_LIMIT = 5000;

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "lotNumber", header: "Lot" },
  { key: "title", header: "Title" },
  { key: "sale", header: "Sale" },
  { key: "wonBy", header: "Won by" },
  { key: "wonOn", header: "Won on" },
  { key: "hammer", header: "Hammer price" },
  { key: "totalDue", header: "Invoice total" },
  { key: "invoice", header: "Invoice status" },
  { key: "dueOn", header: "Due on" },
  { key: "delivery", header: "Delivery" },
];

/** Plain words for the export, never the stored codes. */
const INVOICE_WORDS: Record<AccountPurchaseView["invoice"]["status"], string> = {
  not_invoiced: "Invoice to follow",
  due: "Due",
  overdue: "Overdue",
  processing: "Payment being confirmed",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

const DELIVERY_WORDS: Record<AccountPurchaseView["delivery"]["stage"], string> = {
  awaiting_payment: "After payment",
  choose: "To choose",
  quote_requested: "Quote requested",
  quote_ready: "Quote ready",
  booked: "Delivery booked",
  preparing: "Preparing for collection",
  ready_to_collect: "Ready to collect",
  in_transit: "On its way",
  delivered: "Delivered",
  collected: "Collected",
  cancelled: "Cancelled",
};

const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type AccountPurchasesDeps = {
  reader: IAccountPurchaseFactsReader;
  now: () => Date;
};

/**
 * The acting account's purchases. The domain decides whose wins the member follows (everything
 * for the people who see its money, their own for buyer agents) and works out each invoice and
 * delivery stage; the reader only fetches the facts.
 */
export class AccountPurchasesService implements IAccountPurchasesService {
  constructor(private readonly deps: AccountPurchasesDeps) {}

  private scopeOf(actor: OrganisationMemberActor): AccountRecordsScope | null {
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return null;
    return {
      legalEntityId: actor.legalEntityId,
      memberUserId: scope === "own" ? actor.userId : null,
    };
  }

  async list(
    actor: OrganisationMemberActor,
    page: { limit: number; offset: number },
  ): BuyingResult<PurchasesPage> {
    const scope = this.scopeOf(actor);
    if (!scope) return err(buyingError("insufficient_entity_role"));
    const rows = await this.deps.reader.list({
      ...scope,
      limit: page.limit + 1,
      offset: page.offset,
    });
    const now = this.deps.now();
    return ok({
      items: rows.slice(0, page.limit).map((row) => purchaseView(row, actor, now)),
      nextOffset: rows.length > page.limit ? page.offset + page.limit : null,
    });
  }

  async planPaySeveral(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralPlan> {
    const scope = this.scopeOf(actor);
    if (!scope) return err(buyingError("insufficient_entity_role"));
    const rows = lotIds.length
      ? await this.deps.reader.list({ ...scope, lotIds, limit: lotIds.length, offset: 0 })
      : [];
    const now = this.deps.now();
    const byLot = new Map(
      rows.map((row) => [
        row.lotId,
        paySeveralCandidate(purchaseView(row, actor, now), actor.legalEntityId, INVOICE_CURRENCY),
      ]),
    );
    // A pick outside what the member follows in this account is treated as another account's.
    const picks: PaySeveralCandidate[] = lotIds.map(
      (lotId) =>
        byLot.get(lotId) ?? {
          lotId,
          buyerAccountId: "",
          invoice: "not_invoiced",
          payerMayPay: false,
          totalDue: null,
          currency: INVOICE_CURRENCY,
        },
    );
    const decision = planPaySeveral(actor.legalEntityId, picks);
    return decision.allowed ? ok(decision.plan) : err(buyingError(decision.reason));
  }

  async exportCsv(actor: OrganisationMemberActor): BuyingResult<string> {
    const scope = this.scopeOf(actor);
    if (!scope) return err(buyingError("insufficient_entity_role"));
    const rows = await this.deps.reader.list({ ...scope, limit: EXPORT_LIMIT, offset: 0 });
    const now = this.deps.now();
    const lines = rows.map((row) => {
      const view = purchaseView(row, actor, now);
      return {
        lotNumber: view.lotNumber ?? "",
        title: view.lotTitle,
        sale: view.sale?.title ?? "",
        wonBy: view.wonBy?.name ?? "",
        wonOn: isoDay(view.wonAt),
        hammer: view.hammerPrice,
        totalDue: view.invoice.totalDue ?? "",
        invoice: INVOICE_WORDS[view.invoice.status],
        dueOn: isoDay(view.invoice.dueAt),
        delivery: DELIVERY_WORDS[view.delivery.stage],
      };
    });
    return ok(formatCsvDocument(EXPORT_COLUMNS, lines));
  }
}
