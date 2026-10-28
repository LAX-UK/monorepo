import {
  type EditionRunSpec,
  type ProofType,
  type ProofsKept,
  isOpenRun,
  proofLabel,
  runSize,
} from "./edition-run.js";
import { ShopDomainError } from "./shop-domain-error.js";

/**
 * What staff confirm about a run: how its prints are numbered and signed and what certificate
 * comes with them. Every sentence a shopper reads about these is written by describeEditionFacts;
 * no free text reaches a storefront.
 */

export type Numbering = "on_print" | "on_certificate" | "none";

export const SIGNATURE_MEDIA = ["pencil", "ink"] as const;
export type SignatureMedium = (typeof SIGNATURE_MEDIA)[number];

export const SIGNATURE_PLACES = ["front_lower_margin", "back"] as const;
export type SignaturePlace = (typeof SIGNATURE_PLACES)[number];

export type Signature =
  | { kind: "hand_signed"; medium: SignatureMedium; place: SignaturePlace }
  | { kind: "plate_signed" }
  | { kind: "estate_stamped" }
  | { kind: "estate_signed"; place: SignaturePlace }
  | { kind: "unsigned" };

export type CertificateIssuer = "artist" | "publisher" | "lax";
export type CertificateForm = "paper" | "digital" | "both";
export type CertificateArrival =
  | { kind: "with_print" }
  | { kind: "separately"; withinWeeks: number };

export type Certificate =
  | { kind: "none" }
  | {
      kind: "included";
      issuer: CertificateIssuer;
      form: CertificateForm;
      arrives: CertificateArrival;
      numberedToMatch: boolean;
      /** Why a numbered run's certificate is not numbered to match (rule 7). */
      numberedToMatchReason?: string | undefined;
    };

export type EditionFacts = {
  numbering: Numbering;
  signature: Signature;
  certificate: Certificate;
  confirmed: { by: string; at: Date } | null;
};

export const CERTIFICATE_WITHIN_WEEKS_MAX = 52 as const;

function assertSignature(signature: Signature): void {
  const hasValue = <T extends string>(value: unknown, allowed: readonly T[]): boolean =>
    typeof value === "string" && (allowed as readonly string[]).includes(value);
  switch (signature.kind) {
    case "hand_signed":
      if (
        !hasValue(signature.medium, SIGNATURE_MEDIA) ||
        !hasValue(signature.place, SIGNATURE_PLACES)
      ) {
        throw new ShopDomainError(
          "A hand-signed print needs the medium and the place of the signature",
        );
      }
      return;
    case "estate_signed":
      if (!hasValue(signature.place, SIGNATURE_PLACES)) {
        throw new ShopDomainError("An estate-signed print needs the place of the signature");
      }
      return;
    default: {
      const extra = signature as { medium?: unknown; place?: unknown };
      if (extra.medium !== undefined || extra.place !== undefined) {
        throw new ShopDomainError("This kind of signature takes no medium or place");
      }
    }
  }
}

/** Rules 5 to 8: whether the facts are consistent with each other and with the run they describe. */
export function assertEditionFacts(run: EditionRunSpec, facts: EditionFacts): void {
  if (isOpenRun(run) && facts.numbering !== "none") {
    throw new ShopDomainError("An open edition is never numbered");
  }
  assertSignature(facts.signature);
  const { certificate } = facts;
  if (certificate.kind === "included") {
    const arrives = certificate.arrives;
    if (
      arrives.kind === "separately" &&
      (!Number.isInteger(arrives.withinWeeks) ||
        arrives.withinWeeks < 1 ||
        arrives.withinWeeks > CERTIFICATE_WITHIN_WEEKS_MAX)
    ) {
      throw new ShopDomainError(
        `A certificate sent separately needs a time of 1 to ${CERTIFICATE_WITHIN_WEEKS_MAX} weeks`,
      );
    }
  }
  if (facts.numbering === "on_certificate") {
    if (certificate.kind !== "included" || !certificate.numberedToMatch) {
      throw new ShopDomainError(
        "Numbering on the certificate needs a certificate that is numbered to match",
      );
    }
  }
  if (
    facts.numbering !== "none" &&
    certificate.kind === "included" &&
    !certificate.numberedToMatch
  ) {
    if (!certificate.numberedToMatchReason?.trim()) {
      throw new ShopDomainError(
        "Say why the certificate of a numbered run is not numbered to match",
      );
    }
  }
}

export type DescribedPrint = { editionNumber?: number | null; proofNumber?: number | null };

export type EditionFactRows = {
  edition: string;
  signature: string;
  number: string;
  certificate: string;
  /** Only when proofs were kept outside a limited edition. */
  proofs: string | null;
};

export type EditionFactsDescription = {
  /** The small label above the title. */
  eyebrow: string;
  rows: EditionFactRows;
  /** The meta line on a product card: the run, then the signature. */
  cardLine: string;
  /** Basket and checkout. */
  basketLine: string;
  /** Your orders, from the facts at payment. The number appears only for numbered runs. */
  orderLine: (print?: DescribedPrint) => string;
  /** The description of the print on an invoice, without the owner. */
  invoiceDetail: (print?: DescribedPrint) => string;
};

const PROOF_NAMES: Record<ProofType, { singular: string; plural: string }> = {
  ap: { singular: "artist's proof", plural: "artist's proofs" },
  pp: { singular: "printer's proof", plural: "printer's proofs" },
  hc: { singular: "hors commerce proof", plural: "hors commerce proofs" },
};

const ISSUER_NAMES: Record<CertificateIssuer, string> = {
  artist: "the artist",
  publisher: "the publisher",
  lax: "London Art Exchange",
};

const PLACE_PHRASES: Record<SignaturePlace, string> = {
  front_lower_margin: "front lower margin",
  back: "on the back",
};

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function proofKind(run: EditionRunSpec): ProofType | null {
  return run.type === "proof" ? run.proofType : null;
}

/** "Limited edition of 24", "Open edition" or "Artist's proof": the run without any count of proofs. */
function runName(run: EditionRunSpec): string {
  const proof = proofKind(run);
  if (proof) return capitalise(PROOF_NAMES[proof].singular);
  const size = runSize(run);
  return size === null ? "Open edition" : `Limited edition of ${size}`;
}

function editionRow(run: EditionRunSpec): string {
  if (run.type === "proof") {
    return `${capitalise(PROOF_NAMES[run.proofType].singular)}, one of ${run.size}`;
  }
  return runName(run);
}

function eyebrow(run: EditionRunSpec): string {
  if (run.type === "proof") return capitalise(PROOF_NAMES[run.proofType].singular);
  return isOpenRun(run) ? "Open edition print" : "Limited edition print";
}

function signatureRow(signature: Signature): string {
  switch (signature.kind) {
    case "hand_signed":
      return `Signed by hand in ${signature.medium} by the artist, ${PLACE_PHRASES[signature.place]}`;
    case "plate_signed":
      return "Signature printed in the plate, not signed by hand";
    case "estate_stamped":
      return "Stamped by the artist's estate, not signed by hand";
    case "estate_signed":
      return `Signed by the artist's estate, ${PLACE_PHRASES[signature.place]}`;
    case "unsigned":
      return "Unsigned";
  }
}

function signatureShort(signature: Signature): string {
  switch (signature.kind) {
    case "hand_signed":
      return "Hand-signed";
    case "plate_signed":
      return "Plate-signed";
    case "estate_stamped":
      return "Estate stamp";
    case "estate_signed":
      return "Estate-signed";
    case "unsigned":
      return "Unsigned";
  }
}

function signatureForInvoice(signature: Signature): string {
  switch (signature.kind) {
    case "hand_signed":
      return "signed by hand";
    case "plate_signed":
      return "signature printed in the plate";
    case "estate_stamped":
      return "stamped by the artist's estate";
    case "estate_signed":
      return "signed by the artist's estate";
    case "unsigned":
      return "unsigned";
  }
}

function numberRow(run: EditionRunSpec, numbering: Numbering): string {
  if (numbering === "none" || isOpenRun(run)) return "Not numbered";
  if (numbering === "on_certificate") {
    return "Numbered on the certificate. Your number appears in your order once payment is confirmed.";
  }
  if (run.type === "proof") {
    return `Marked ${proofLabel(run.proofType)} by hand, numbered 1 to ${run.size}`;
  }
  return "Numbered by hand on the print. Your number appears in your order once payment is confirmed.";
}

function certificateName(form: CertificateForm): string {
  if (form === "digital") return "Digital certificate";
  return form === "both" ? "Paper and digital certificate" : "Certificate";
}

function paperDelivery(arrives: CertificateArrival): string {
  if (arrives.kind === "with_print") return "sent with your print";
  const weeks = arrives.withinWeeks;
  return `sent separately within ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

function certificateDelivery(certificate: Extract<Certificate, { kind: "included" }>): string {
  if (certificate.form === "digital") return "in your LAX Account";
  const paper = paperDelivery(certificate.arrives);
  return certificate.form === "both" ? `${paper}, with a digital copy in your LAX Account` : paper;
}

function certificateRow(certificate: Certificate): string {
  if (certificate.kind === "none") return "No certificate of authenticity";
  return `${certificateName(certificate.form)} of authenticity from ${ISSUER_NAMES[certificate.issuer]}, ${certificateDelivery(certificate)}`;
}

function certificateShort(certificate: Certificate): string | null {
  if (certificate.kind === "none") return null;
  return `${certificateName(certificate.form)} from ${ISSUER_NAMES[certificate.issuer]}`;
}

function proofsRow(run: EditionRunSpec, kept: ProofsKept | undefined): string | null {
  const size = runSize(run);
  if (!kept || size === null || run.type === "proof") return null;
  const parts = (["ap", "pp", "hc"] as const)
    .filter((type) => kept[type] > 0)
    .map((type) => {
      const names = PROOF_NAMES[type];
      return `${kept[type]} ${kept[type] === 1 ? names.singular : names.plural}`;
    });
  if (parts.length === 0) return null;
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return `The artist also kept ${list}, outside the edition of ${size}.`;
}

/** The number a shopper may be told: only on numbered runs, and only when the print has one. */
function numberedPrintText(
  run: EditionRunSpec,
  numbering: Numbering,
  print: DescribedPrint | undefined,
): { order: string; invoice: string } | null {
  if (numbering === "none" || isOpenRun(run) || !print) return null;
  if (run.type === "proof") {
    if (print.proofNumber == null) return null;
    const label = `${proofLabel(run.proofType)} ${print.proofNumber}/${run.size}`;
    return { order: label, invoice: label };
  }
  if (print.editionNumber == null) return null;
  const size = runSize(run);
  const suffix = numbering === "on_certificate" ? " (on the certificate)" : "";
  return {
    order: `No. ${print.editionNumber} of ${size}${suffix}`,
    invoice: `no. ${print.editionNumber}`,
  };
}

/** Writes every public sentence about a run and its confirmed facts. */
export function describeEditionFacts(
  run: EditionRunSpec,
  facts: EditionFacts,
  options: { proofsKept?: ProofsKept } = {},
): EditionFactsDescription {
  const { numbering, signature, certificate } = facts;
  const name = runName(run);
  const signed = signatureShort(signature);
  const open = isOpenRun(run);
  const certificateText = certificateShort(certificate);
  return {
    eyebrow: eyebrow(run),
    rows: {
      edition: editionRow(run),
      signature: signatureRow(signature),
      number: numberRow(run, numbering),
      certificate: certificateRow(certificate),
      proofs: proofsRow(run, options.proofsKept),
    },
    cardLine: `${name} · ${signed}`,
    basketLine: [
      name,
      signed,
      ...(numbering !== "none" && !open ? ["Numbered"] : []),
      ...(certificate.kind === "included" ? ["With certificate"] : []),
    ].join(" · "),
    orderLine: (print) => {
      const numbered = numberedPrintText(run, numbering, print);
      return [
        numbered?.order ?? name,
        signed,
        ...(numbering === "none" && !open ? ["Not numbered"] : []),
        ...(certificateText ? [certificateText] : []),
      ].join(" · ");
    },
    invoiceDetail: (print) => {
      const numbered = numberedPrintText(run, numbering, print);
      return [
        numbered && run.type !== "proof" ? `${name}, ${numbered.invoice}` : name,
        ...(numbered && run.type === "proof" ? [numbered.invoice] : []),
        signatureForInvoice(signature),
        ...(certificate.kind === "included" ? ["with certificate of authenticity"] : []),
      ].join(", ");
    },
  };
}
