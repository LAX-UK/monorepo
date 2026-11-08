import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PrivateSaleDealStage } from "@auction/types";
import type { PartyDealNeed, PartyDealRow } from "./party-deals.schema";

/**
 * How a client reads their own private sale. No checks, screening or system terms: a person is
 * told what they need to do, and the other side is always LAX.
 */

export const PRIVATE_SALES_PATH = "/private-sales";

export function privateSaleHref(reference: string): string {
  return `${PRIVATE_SALES_PATH}/${encodeURIComponent(reference)}`;
}

type Tone = "neutral" | "info" | "success" | "warning";
type Shape = "ring" | "dot" | "check";
type Badge = { label: string; tone: Tone; shape: Shape };

export const BUYER_STAGE_BADGES = {
  proposed: { label: "Offer under discussion", tone: "neutral", shape: "ring" },
  offer: { label: "Offer under discussion", tone: "neutral", shape: "ring" },
  agreed: { label: "Agreed", tone: "info", shape: "dot" },
  cleared: { label: "Agreed", tone: "info", shape: "dot" },
  invoiced: { label: "Payment due", tone: "warning", shape: "ring" },
  paid: { label: "Paid", tone: "success", shape: "dot" },
  released: { label: "Handed over", tone: "success", shape: "dot" },
  settled: { label: "Complete", tone: "success", shape: "check" },
  cancelled: { label: "Cancelled", tone: "neutral", shape: "check" },
} as const satisfies Record<PrivateSaleDealStage, Badge>;

export const SELLER_STAGE_BADGES = {
  proposed: { label: "In a private sale", tone: "neutral", shape: "ring" },
  offer: { label: "In a private sale", tone: "neutral", shape: "ring" },
  agreed: { label: "Sale agreed", tone: "info", shape: "dot" },
  cleared: { label: "Sale agreed", tone: "info", shape: "dot" },
  invoiced: { label: "Awaiting payment", tone: "info", shape: "dot" },
  paid: { label: "Buyer has paid", tone: "success", shape: "dot" },
  released: { label: "Handed over", tone: "success", shape: "dot" },
  settled: { label: "Paid out", tone: "success", shape: "check" },
  cancelled: { label: "Cancelled", tone: "neutral", shape: "check" },
} as const satisfies Record<PrivateSaleDealStage, Badge>;

export function stageBadge(role: "buyer" | "seller", stage: PrivateSaleDealStage): Badge {
  return (role === "buyer" ? BUYER_STAGE_BADGES : SELLER_STAGE_BADGES)[stage];
}

/** The one thing to do next, as the row's step: a short label and where it is done. */
export function needStep(
  need: PartyDealNeed,
  reference: string,
): { label: string; accessibleName: string; href: string } {
  const detail = privateSaleHref(reference);
  switch (need) {
    case "accept_terms":
      return {
        label: "Accept the terms",
        accessibleName: `Accept the terms for ${reference}`,
        href: detail,
      };
    case "verify_identity":
      return {
        label: "Verify your identity",
        accessibleName: `Verify your identity for ${reference}`,
        href: CLIENT_ROUTES.verifyIdentity,
      };
    case "proof_of_funds":
      return {
        label: "Add proof of funds",
        accessibleName: `Add proof of funds for ${reference}`,
        href: CLIENT_ROUTES.sourceOfFunds,
      };
    case "pay":
      return { label: "Pay now", accessibleName: `Pay for ${reference}`, href: detail };
  }
}

/** Each side's deals for one list: buyers see them under Purchases, sellers under Consignments. */
export function dealsForRole(
  rows: readonly PartyDealRow[],
  role: "buyer" | "seller",
): PartyDealRow[] {
  return rows.filter((row) => row.role === role && row.stage !== "cancelled");
}

/** The figure a row shows: the buyer's total, or what the seller receives; nothing while the price is under discussion. */
export function rowFigure(row: PartyDealRow): { value: number; label: string } | null {
  if (row.role === "buyer" && row.totalDueMinor !== null) {
    return {
      value: row.totalDueMinor,
      label:
        row.stage === "paid" || row.stage === "released" || row.stage === "settled"
          ? "Paid"
          : "Total due",
    };
  }
  if (row.role === "seller" && row.netToSellerMinor !== null) {
    return {
      value: row.netToSellerMinor,
      label: row.stage === "settled" ? "Paid out" : "You receive",
    };
  }
  return null;
}

/** Where the deal stands, in a sentence, for the person's side. */
export function stageSentence(
  role: "buyer" | "seller",
  stage: PrivateSaleDealStage,
  paymentDue: string | null,
): string {
  if (stage === "cancelled") return "This private sale was cancelled.";
  if (role === "buyer") {
    switch (stage) {
      case "proposed":
      case "offer":
        return "The price is still being agreed. Nothing is due yet.";
      case "agreed":
      case "cleared":
        return "The price is agreed. We'll send your invoice shortly.";
      case "invoiced":
        return paymentDue
          ? `Your invoice is ready. Pay by ${paymentDue}.`
          : "Your invoice is ready.";
      case "paid":
        return "Paid. We're arranging collection or delivery.";
      case "released":
        return "The work has been handed over.";
      case "settled":
        return "Complete.";
    }
  }
  switch (stage) {
    case "proposed":
    case "offer":
      return "Your work is in a private sale. The price is still being agreed.";
    case "agreed":
    case "cleared":
      return "The price is agreed. We'll invoice the buyer shortly.";
    case "invoiced":
      return "The buyer has been invoiced.";
    case "paid":
      return "The buyer has paid. Your payout follows once the work is handed over.";
    case "released":
      return "The work has been handed over. Your payout is being prepared.";
    case "settled":
      return "You've been paid out.";
  }
}
