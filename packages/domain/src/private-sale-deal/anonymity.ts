import type {
  PrivateSaleDealDetail,
  PrivateSaleDealPartyView,
  PrivateSaleDealStaffView,
  PrivateSaleDocumentAudience,
  PrivateSalePartyRole,
} from "@auction/types";
import { computeDealMoney } from "./money.js";

/** Who is looking at a deal. */
export type DealViewer = { audience: "staff" } | { audience: PrivateSalePartyRole };

const PRICE_AGREED_STAGES = new Set([
  "agreed",
  "cleared",
  "invoiced",
  "paid",
  "released",
  "settled",
]);

function moneyOf(deal: PrivateSaleDealDetail) {
  return deal.priceMinor === null
    ? null
    : computeDealMoney({
        priceMinor: deal.priceMinor,
        buyerFeeBps: deal.buyerFeeBps,
        sellerCommissionBps: deal.sellerCommissionBps,
        costsMinor: deal.costsMinor,
      });
}

/** Staff see the whole deal: both parties, their checks and every document. */
export function projectDealForStaff(deal: PrivateSaleDealDetail): PrivateSaleDealStaffView {
  return { audience: "staff", deal, money: moneyOf(deal) };
}

const sees = (audience: PrivateSaleDocumentAudience, role: PrivateSalePartyRole): boolean =>
  audience === "both" || audience === role;

/**
 * What one party may see. The other side appears as LAX unless the deal discloses parties, and
 * never with an identifier, a check result or a fee that is not theirs. The price is "under
 * discussion" until both sides have agreed it. Everything is built field by field from an
 * allowlist, so a column added to the deal later is hidden until someone decides to show it.
 */
export function projectDealForParty(
  deal: PrivateSaleDealDetail,
  role: PrivateSalePartyRole,
): PrivateSaleDealPartyView | null {
  const you = role === "seller" ? deal.seller : deal.buyer;
  if (!you) return null;
  const other = role === "seller" ? deal.buyer : deal.seller;
  const money = moneyOf(deal);
  const agreed = money !== null && PRICE_AGREED_STAGES.has(deal.stage);
  return {
    audience: role,
    reference: deal.reference,
    stage: deal.stage,
    itemSubmissionId: deal.itemSubmissionId,
    you: { legalEntityId: you.legalEntityId, displayName: you.displayName },
    counterparty:
      deal.partiesDisclosed && other
        ? { disclosed: true, label: other.displayName }
        : { disclosed: false, label: "LAX" },
    priceState: agreed ? "agreed" : "under_discussion",
    buyerMoney:
      agreed && role === "buyer"
        ? {
            priceMinor: money.priceMinor,
            buyerFeeMinor: money.buyerFeeMinor,
            totalDueMinor: money.totalDueMinor,
          }
        : null,
    sellerMoney:
      agreed && role === "seller"
        ? {
            priceMinor: money.priceMinor,
            sellerCommissionMinor: money.sellerCommissionMinor,
            costsMinor: money.costsMinor,
            netToSellerMinor: money.netToSellerMinor,
          }
        : null,
    paymentDueAt: role === "buyer" ? deal.paymentDueAt : null,
    collectionDueAt: deal.collectionDueAt,
    documents: deal.documents
      .filter(
        (d) =>
          sees(d.audience, role) &&
          // A document held for one party is theirs alone.
          (d.legalEntityId === null || d.legalEntityId === you.legalEntityId),
      )
      .map((d) => ({
        id: d.id,
        kind: d.kind,
        version: d.version,
        acceptedAt: d.acceptedAt,
        uploadObjectId: d.uploadObjectId,
      })),
  };
}
