import type { CertificateForm, CertificateIssuer, EditionFacts } from "./edition-facts.js";
import type { ExpectedPrint, PackCandidate, PackConfirmation } from "./print-confirmation.js";
export { AUTHORITY_REFERENCE_MAX_LENGTH, assertAuthorityReference } from "./authority-reference.js";
import { ShopDomainError } from "./shop-domain-error.js";

/**
 * Rules for fulfilling the exact print that was sold: which print to send when the one sold
 * cannot go, who may approve a swap, what certificate a confirmed print gets, and when an order
 * may leave packing. Pure functions; the use cases in shop-api apply them inside a transaction.
 */

/** A free print as the store sees it, with what orders the "next" one. */
export type SendCandidate = PackCandidate & {
  stockRef: number;
  /** When the print was offered for sale; the earliest offered is sent first. */
  saleAuthorisedAt: Date | null;
};

function offeredOrder(a: SendCandidate, b: SendCandidate): number {
  const at = a.saleAuthorisedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bt = b.saleAuthorisedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return at - bt || a.stockRef - b.stockRef;
}

/**
 * The next print to send in place of `expected`: a free print the same party owns comes first
 * (the payout does not change), then the earliest offered, lowest number. Null when none is free.
 */
export function nextPrintToSend(
  expected: ExpectedPrint,
  candidates: readonly SendCandidate[],
): SendCandidate | null {
  const free = candidates.filter(
    (candidate) => candidate.freeToSell && candidate.editionId !== expected.editionId,
  );
  const sameOwner = free.filter(
    (candidate) =>
      expected.ownerPartyId !== null && candidate.ownerPartyId === expected.ownerPartyId,
  );
  const pool = sameOwner.length > 0 ? sameOwner : free;
  return [...pool].sort(offeredOrder)[0] ?? null;
}

export const SWAP_REASON_MAX_LENGTH = 300;

/** Why a print is set aside is recorded, so the swap can be explained later. */
export function assertSwapReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (!trimmed) throw new ShopDomainError("Say why this print is being replaced");
  if (trimmed.length > SWAP_REASON_MAX_LENGTH) {
    throw new ShopDomainError(`Keep the reason to ${SWAP_REASON_MAX_LENGTH} characters or fewer`);
  }
  return trimmed;
}

export type SwapAuthority = { canCrossOwner: boolean };

/**
 * A swap to a print the same party owns is for packing staff. A print with another owner moves
 * the seller and the pending payout, so only a shop admin may do it.
 */
export function assertSwapAllowed(
  decision: Pick<PackConfirmation, "outcome">,
  authority: SwapAuthority,
): "same_owner" | "cross_owner" {
  if (decision.outcome === "swap_allowed") return "same_owner";
  if (decision.outcome === "swap_needs_admin") {
    if (!authority.canCrossOwner) {
      throw new ShopDomainError(
        "This print has a different owner. A shop admin must move the seller and the payout",
      );
    }
    return "cross_owner";
  }
  throw new ShopDomainError("That print cannot be sent in place of the one sold");
}

/** How the payout follows a swap, decided by who sold the line and who owns the replacement. */
export type PayoutFollowsSwap =
  | { action: "keep" }
  | { action: "repoint"; toPartyId: string }
  | { action: "cancel" }
  | { action: "create"; toPartyId: string };

/**
 * Seller and payout follow the print that is sent. A LAX-owned print earns no artist payout, so
 * moving to or from LAX removes or adds the payout row; moving between payees re-points it.
 */
export function payoutAfterSwap(input: {
  fromPartyId: string;
  fromIsLax: boolean;
  toPartyId: string;
  toIsLax: boolean;
}): PayoutFollowsSwap {
  if (input.fromPartyId === input.toPartyId) return { action: "keep" };
  if (input.toIsLax) return input.fromIsLax ? { action: "keep" } : { action: "cancel" };
  if (input.fromIsLax) return { action: "create", toPartyId: input.toPartyId };
  return { action: "repoint", toPartyId: input.toPartyId };
}

export type CertificateSettings = {
  /** Whether London Art Exchange Ltd issues digital certificates at all. Off until cleared. */
  laxCertificatesEnabled: boolean;
  /** The artist's written authority is on record for the run. */
  authorityRecorded: boolean;
};

export type CertificateDecision =
  | { action: "none" }
  /** A digital certificate is recorded as issued now, in LAX Account. */
  | { action: "issue_digital"; issuer: CertificateIssuer; form: CertificateForm }
  /** A paper certificate packed with the print: recorded as issued when the print is packed. */
  | { action: "issue_with_print"; issuer: CertificateIssuer; form: CertificateForm }
  /** A certificate staff or the issuer must send: it stays on the "to send" list until marked. */
  | {
      action: "to_send";
      issuer: CertificateIssuer;
      form: CertificateForm;
      reason: "issuer_sends" | "arrives_separately" | "lax_certificates_off";
    }
  | { action: "blocked"; reason: string };

/**
 * What a confirmed print gets for its certificate, from the run's facts. LAX issues a digital
 * certificate straight away only when the setting is on and the artist's written authority is
 * recorded; otherwise it waits on the "to send" list. A paper certificate that ships with the
 * print is recorded at packing; one that arrives separately, or that its artist or publisher
 * sends, waits to be marked sent. A certificate that carries a number is issued for the
 * confirmed number only (the caller passes that label).
 */
export function decideCertificate(
  facts: Pick<EditionFacts, "certificate">,
  settings: CertificateSettings,
): CertificateDecision {
  const certificate = facts.certificate;
  if (certificate.kind === "none") return { action: "none" };
  const { issuer, form, arrives } = certificate;
  if (issuer === "lax" && !settings.authorityRecorded) {
    return {
      action: "blocked",
      reason:
        "Record the artist's written authority before London Art Exchange issues certificates",
    };
  }
  if (issuer === "lax" && (form === "digital" || form === "both")) {
    return settings.laxCertificatesEnabled
      ? { action: "issue_digital", issuer, form }
      : { action: "to_send", issuer, form, reason: "lax_certificates_off" };
  }
  if (arrives.kind === "separately") {
    return { action: "to_send", issuer, form, reason: "arrives_separately" };
  }
  if (issuer !== "lax" && form === "digital") {
    return { action: "to_send", issuer, form, reason: "issuer_sends" };
  }
  return { action: "issue_with_print", issuer, form };
}

/** The wording on a staff screen for a certificate waiting to be sent. */
export function certificateToSendLabel(
  reason: Extract<CertificateDecision, { action: "to_send" }>["reason"],
): string {
  switch (reason) {
    case "issuer_sends":
      return "The issuer sends this certificate";
    case "arrives_separately":
      return "Send the certificate separately";
    case "lax_certificates_off":
      return "Digital certificates from London Art Exchange are switched off";
  }
}

/** Rule 16: a numbered print leaves packing only once its number is confirmed against the line. */
export type PackingLine = {
  orderLineId: string;
  /** The run numbers its prints (on the print or on the certificate). */
  numbered: boolean;
  packConfirmed: boolean;
};

export function linesBlockingDispatch(lines: readonly PackingLine[]): string[] {
  return lines.filter((line) => line.numbered && !line.packConfirmed).map((l) => l.orderLineId);
}

/** A hors commerce proof may be offered for sale only once a shop admin has approved it. */
export function assertHorsCommerceSellable(input: {
  proofType: "ap" | "pp" | "hc" | null;
  approvedAt: Date | null;
}): void {
  if (input.proofType === "hc" && input.approvedAt === null) {
    throw new ShopDomainError(
      "A hors commerce proof can be offered for sale only after a shop admin approves it",
    );
  }
}
