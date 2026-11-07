import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pins what a Shop category may read. A reader's mapper only sees the columns its query selected,
 * so keeping a column out of the query keeps it out of the file for good. These are the tables and
 * columns that hold other customers' data, staff handling, internal notes and payment-provider
 * internals. A reader that names one fails here, so it cannot slip in later.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(dir)
  .filter((name) => name.endsWith(".category.ts"))
  .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));

const FORBIDDEN_TABLES = [
  "shopAdminAudit", // staff audit
  "shopAdminCommand",
  "shopAdminIdempotency",
  "shopEnquiryNote", // internal notes on an enquiry
  "shopArtistApplicationEvent", // review history with staff identities and notes
  "shopStaffMember",
  "shopStaffRoleAssignment",
  "shopStaffSavedView",
  "shopDispute", // the processor's dispute record
  "shopProcessedPaymentEvent",
  "shopPayeeConnectAccount",
  "shopPayeeCompliance",
  "shopClientAssignment", // which broker handles the client
  "shopStockHold",
  "shopProductionTask",
  "shopCertificate",
  "shopGuestOrderLink", // the emailed link's token hash
  "shopIdentitySession",
  "shopIdentityMergeInbox",
  "emailEvent", // provider delivery events
  "domainEvent",
];

const FORBIDDEN_COLUMNS = [
  // payment provider internals
  "shopOrder.stripeCheckoutSessionId",
  "shopOrder.stripePaymentIntentId",
  "shopOrder.idempotencyKey",
  "shopRefund.stripeRefundId",
  "shopRefund.lastError",
  "shopRefund.submitAttempts",
  "shopRefund.requestedBySubjectId",
  "shopRefund.idempotencyKey",
  "shopRefund.source",
  "shopParty.stripeCustomerId",
  "shopOriginalSale.stripeInvoiceId",
  "shopOriginalSale.recordedBySubjectId",
  // the seller's side and stock handling of an order line
  "shopOrderLine.sellerPartyId",
  "shopOrderLine.packConfirmedBy",
  "shopOrderLine.packConfirmedAt",
  "shopOrderLine.editionFactsSnapshot",
  "shopOrderLine.swappedFromEditionId",
  "shopFulfilment.storageLocation",
  "shopOrder.buyerPartyId",
  // the seller's payout ledger: staff payment handling, holds and accounting flags
  "shopPayoutLedger.paidBySubjectId",
  "shopPayoutLedger.blockedReason",
  "shopPayoutLedger.sellerAcquisitionSource",
  "shopPayoutLedger.laxActedAsAgent",
  "shopPayoutLedger.arrApplicable",
  "shopThirdPartySale.buyerPartyId",
  "shopThirdPartySale.brokerPartyId",
  "shopThirdPartySale.recordedBySubjectId",
  // staff triage and notes
  "shopArtworkInterest.assigneeSubject",
  "shopArtworkInterest.unsubscribeTokenHash",
  "shopGeneralEnquiry.assigneeSubject",
  "shopArtistApplication.assigneeSubject",
  "shopSaleAuthorityRequest.handledBySubjectId",
  // the shop-wide guest record: its email and name are matched to nobody
  "shopGuestCustomer.email",
  "shopGuestCustomer.name",
  "shopGuestCustomer.phone",
  // mail content and addresses
  "emailOutbox.vars",
  "emailOutbox.toSnapshot",
  "emailOutbox.lastError",
  "emailOutbox.messageId",
  "emailOutbox.userId",
  // account administration
  "shopUserProfile.mergedIntoSubjectId",
  "shopUserProfile.disabledAt",
  // other customers' baskets are reached only through the person's own basket
  "shopBasket.anonymousTokenHash",
];

const references = (text: string, term: string) =>
  new RegExp(`(?<![\\w.])${term.replace(".", "\\.")}(?![\\w])`).test(
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
  );

const text = (name: string) => sources.find((s) => s.name === name)?.text ?? "";

describe("Shop subject export: what each reader may read", () => {
  it("finds the category readers", () => {
    expect(sources.length).toBeGreaterThanOrEqual(9);
  });

  it.each(FORBIDDEN_TABLES)("no reader reads %s", (table) => {
    for (const { name, text: source } of sources) {
      expect(references(source, table), `${name} references ${table}`).toBe(false);
    }
  });

  it.each(FORBIDDEN_COLUMNS)("no reader selects %s", (column) => {
    for (const { name, text: source } of sources) {
      expect(references(source, column), `${name} references ${column}`).toBe(false);
    }
  });

  it("reads the payout ledger only in the selling payouts category", () => {
    for (const { name, text: source } of sources) {
      expect(references(source, "shopPayoutLedger"), name).toBe(
        name === "selling-payouts.category.ts",
      );
    }
  });

  it("selects named columns, never a whole row", () => {
    for (const { name, text: source } of sources) {
      expect(source.match(/\.select\(\)/g) ?? [], name).toEqual([]);
    }
  });

  it("scopes every person-owned table to the subject or to the person's own parties", () => {
    expect(text("orders.category.ts")).toContain("eq(shopOrder.identitySubjectId, s)");
    expect(text("orders.category.ts")).toContain(
      "inArray(shopOriginalSale.buyerPartyId, partyIds)",
    );
    expect(text("payments.category.ts")).toContain("eq(shopOrder.identitySubjectId, s)");
    expect(text("invoices.category.ts")).toContain("eq(shopOrder.identitySubjectId, s)");
    expect(text("basket.category.ts")).toContain("eq(shopBasket.identitySubjectId, s)");
    expect(text("enquiries.category.ts")).toContain("eq(shopArtworkInterest.identitySubjectId, s)");
    expect(text("enquiries.category.ts")).toContain("eq(shopGeneralEnquiry.identitySubjectId, s)");
    expect(text("saved-works.category.ts")).toContain("eq(shopSavedArtwork.identitySubjectId, s)");
    expect(text("selling-payouts.category.ts")).toContain(
      "inArray(shopPayoutLedger.ownerPartyId, partyIds)",
    );
    expect(text("selling.category.ts")).toContain(
      "eq(shopArtistApplication.applicantSubjectId, s)",
    );
    expect(text("selling.category.ts")).toContain(
      "inArray(shopSaleAuthorityRequest.ownerPartyId, partyIds)",
    );
  });

  it("reaches guest orders only through the account that claimed them, never by email", () => {
    const orders = text("orders.category.ts");
    expect(orders).not.toContain("shopGuestCustomer");
    expect(orders).not.toMatch(/lower\(|contactEmail|\.email/);
  });

  it("reads only client-visible documents", () => {
    expect(text("invoices.category.ts")).toContain('eq(shopDocument.visibility, "client")');
  });

  it("reads mail only for the templates addressed to the customer", () => {
    expect(text("notifications-and-marketing.category.ts")).toContain(
      "inArray(emailOutbox.template, TEMPLATE_IDS)",
    );
  });
});
