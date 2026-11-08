import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pins what a Bid category may read. A reader's mapper only sees the columns its query selected,
 * so keeping a column out of the query keeps it out of the file for good. These are the tables and
 * columns that hold exempt material (screening, risk and AML, internal review and negotiation
 * notes, other people's identities, secrets, and the seller's side of a sale). A reader that names
 * one fails here, so it cannot slip in later.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(dir)
  .filter((name) => name.endsWith(".category.ts"))
  .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));

/** Matches `table.column` references and bare imports. */
const FORBIDDEN_TABLES = [
  "kycWatchlistScreening",
  "adminReviewTask",
  "sourceOfFundsDocumentReview",
  "sourceOfFunds", // the case itself carries triage and review notes and the exposure assessment
  "crmRecordLink",
  "disputeAllocation", // the seller's share and clawback
  "emailOutbox",
  "emailEvent",
  "domainEvent",
  "auditLog",
  "user", // Identity-owned; Bid reads names through its directory projection
];

const FORBIDDEN_COLUMNS = [
  // AML hold and suspension on the Bid profile
  "bidUserProfile.amlHoldStatus",
  "bidUserProfile.amlHoldReason",
  "bidUserProfile.amlHoldAt",
  "bidUserProfile.suspendedAt",
  "bidUserProfile.suspendedReason",
  "bidUserProfile.identityDisabledAt",
  "bidUserProfile.role",
  "bidUserProfile.staffRole",
  // verification provider risk signals and extracted document data
  "kycVerification.decisionRiskScore",
  "kycVerification.decisionIpCountry",
  "kycVerification.decisionPayload",
  "kycVerification.verifiedIdNumber",
  "kycVerification.providerSessionId",
  // source-of-funds review
  "sourceOfFundsDocument.reviewStatus",
  "sourceOfFundsDocument.retentionClass",
  // internal notes and decisions on a registration, booking, consignment, unsold choice, fulfilment
  "saleRegistration.laxNotes",
  "saleRegistration.rejectionReason",
  "saleRegistration.decidedByUserId",
  "saleRegistration.bidLimit",
  "telephoneBidBooking.notes",
  "telephoneBidBooking.clerkUserId",
  "itemSubmission.reviewNotes",
  "itemSubmission.rejectionReason",
  "itemSubmission.reviewedBy",
  "itemSubmission.assignedToUserId",
  "consignmentAgreement.relistReserveFloor",
  "consignmentAgreement.commissionPercent",
  "unsoldLotChoice.staffNote",
  "lotFulfilment.notes",
  // staff-only facts on a collection booking: why it went over capacity, who handed over or cancelled
  "collectionBooking.overCapacityReason",
  "collectionBooking.outcomeByUserId",
  "collectionBooking.cancelledByUserId",
  "collectionBooking.idempotencyKey",
  "collectionBooking.policyVersion",
  "lotFulfilment.releaseApprovedByUserId",
  "conditionReportRequest.fulfilledByUserId",
  // staff-only thread content and thread handling
  "consignmentThread.coveringUserId",
  "consignmentThread.closedByUserId",
  "consignmentMessageAttachment",
  // the seller's side of a payment, and processor identifiers
  "payment.platformFee",
  "payment.sellerLegalEntityId",
  "payment.stripeChargeId",
  "payment.stripePaymentIntentId",
  "payment.stripeRefundId",
  "paymentExternalRef.lastError",
  "payout.failureReason",
  "payout.xeroBillId",
  "payout.stripeTransferId",
  // other bidders: the winning flag's owner and the lot's running price are not read
  "lot.currentPrice",
  "lot.reservePrice",
  "lot.sellerLegalEntityId",
  // devices, secrets and advertising identifiers
  "pushSubscription.endpoint",
  "pushSubscription.p256dh",
  "pushSubscription.auth",
  "marketingClickIds.fbp",
  "marketingClickIds.fbc",
  // other people's contact details
  "userInvitation.email",
  "userInvitation.tokenHash",
  "bidIdentityDirectory.email", // organisations reads it only to match the person's own invitations
];

/** Where a normally forbidden column is allowed, with the reason. */
const ALLOWED: Record<string, { files: string[] }> = {
  // The hammer price of a lot the person won, or of their own consigned work that sold.
  "lot.currentPrice": { files: ["purchases.category.ts", "consignments.category.ts"] },
  // Matches invitations addressed to the person's own email; the address is never selected.
  "bidIdentityDirectory.email": { files: ["organisations.category.ts"] },
  "userInvitation.email": { files: ["organisations.category.ts"] },
  // Joined to the directory to show the replying staff member's first name only.
  "conditionReportRequest.fulfilledByUserId": { files: ["messages.category.ts"] },
};

const references = (text: string, term: string) =>
  new RegExp(`(?<![\\w.])${term.replace(".", "\\.")}(?![\\w])`).test(
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
  );

describe("Bid subject export: what each reader may read", () => {
  it("finds the category readers", () => {
    expect(sources.length).toBeGreaterThanOrEqual(13);
  });

  it.each(FORBIDDEN_TABLES)("no reader reads %s", (table) => {
    for (const { name, text } of sources) {
      expect(references(text, table), `${name} references ${table}`).toBe(false);
    }
  });

  it.each(FORBIDDEN_COLUMNS)("no reader selects %s", (column) => {
    const allowed = ALLOWED[column]?.files ?? [];
    for (const { name, text } of sources) {
      if (allowed.includes(name)) continue;
      expect(references(text, column), `${name} references ${column}`).toBe(false);
    }
  });

  it("selects named columns, never a whole row, except the person's own preferences", () => {
    for (const { name, text } of sources) {
      const wholeRowSelects = (text.match(/\.select\(\)/g) ?? []).length;
      expect(wholeRowSelects, name).toBe(name === "notifications.category.ts" ? 1 : 0);
    }
  });

  it("reads a lot's price only for a lot the person won or consigned", () => {
    const purchases = sources.find((s) => s.name === "purchases.category.ts")?.text ?? "";
    expect(purchases).toContain("eq(lot.winnerId, s)");
    const consignments = sources.find((s) => s.name === "consignments.category.ts")?.text ?? "";
    expect(consignments).toContain("inArray(lot.id, lotIds)");
  });
});
