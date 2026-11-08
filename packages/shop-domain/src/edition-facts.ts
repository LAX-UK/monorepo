import {
  type EditionRunSpec,
  type ProofType,
  type ProofsKept,
  isOpenRun,
  proofLabel,
  runSize,
} from "./edition-run.js";
import { assertAuthorityReference } from "./print-fulfilment.js";
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

export const STAMPS = ["none", "publisher_blind", "printer_blind", "estate_back"] as const;
export type Stamp = (typeof STAMPS)[number];

/** Who published the run: the artist, London Art Exchange, or another publisher from the list. */
export type Publisher = { kind: "artist" } | { kind: "lax" } | { kind: "named"; name: string };

export const PARTY_NAME_MAX = 80 as const;

export type CertificateIssuer = "artist" | "publisher" | "lax";

export const AUTHORITY_GIVERS = ["artist", "estate"] as const;
export type AuthorityGiver = (typeof AUTHORITY_GIVERS)[number];

/**
 * The written authority a certificate London Art Exchange issues stands on: who gave it, the date
 * of their letter and where the signed letter is kept. A saved authority has all three; a
 * storefront is told only who gave it, and an older sale's record may hold fewer.
 */
export type CertificateAuthority = {
  givenBy: AuthorityGiver;
  datedOn?: string | undefined;
  /** Where the signed letter is kept. Staff only; never shown to shoppers. */
  reference?: string | undefined;
};
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
      /** Required when London Art Exchange is the issuer, and only then. */
      authority?: CertificateAuthority;
    };

export type EditionFacts = {
  numbering: Numbering;
  signature: Signature;
  certificate: Certificate;
  /** A blind stamp on the print; absent or "none" says nothing. */
  stamp?: Stamp | undefined;
  /** The studio that printed the run, as spelled in the Settings list; absent says nothing. */
  printedBy?: string | null | undefined;
  /** Who published the run; absent says nothing. */
  publishedBy?: Publisher | null | undefined;
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function assertPartyName(name: unknown, what: string): void {
  if (typeof name !== "string" || name.trim().length === 0 || name.trim() !== name) {
    throw new ShopDomainError(`${what} needs a name from the list`);
  }
  if (name.length > PARTY_NAME_MAX) {
    throw new ShopDomainError(`${what} must be at most ${PARTY_NAME_MAX} characters`);
  }
}

/** The London Art Exchange guardrail: it certifies only on the written authority of the artist or estate. */
function assertCertificateAuthority(certificate: Certificate, requireAuthority: boolean): void {
  if (certificate.kind !== "included") return;
  const { authority } = certificate;
  if (certificate.issuer === "lax" && !authority && !requireAuthority) return;
  if (certificate.issuer !== "lax") {
    if (authority)
      throw new ShopDomainError("Only a certificate London Art Exchange issues has an authority");
    return;
  }
  if (!authority) {
    throw new ShopDomainError(
      "A certificate London Art Exchange issues needs the artist's or estate's written authority",
    );
  }
  if (!(AUTHORITY_GIVERS as readonly string[]).includes(authority.givenBy)) {
    throw new ShopDomainError("Say whether the artist or their estate gave the authority");
  }
  if (!requireAuthority && authority.datedOn === undefined) return;
  if (authority.datedOn === undefined || !isRealDate(authority.datedOn)) {
    throw new ShopDomainError("The authority needs the date of the letter");
  }
  if (requireAuthority) assertAuthorityReference(authority.reference);
}

function assertPrintParties(facts: EditionFacts): void {
  if (facts.stamp !== undefined && !(STAMPS as readonly string[]).includes(facts.stamp)) {
    throw new ShopDomainError("Choose one of the stamps listed");
  }
  if (facts.printedBy != null) assertPartyName(facts.printedBy, "Printed by");
  const published = facts.publishedBy;
  if (published?.kind === "named") assertPartyName(published.name, "Published by");
}

/** Rules 5 to 8: whether the facts are consistent with each other and with the run they describe. */
export function assertEditionFacts(
  run: EditionRunSpec,
  facts: EditionFacts,
  options: {
    /** False for facts stored before the authority was recorded, which are read but never saved. */
    requireAuthority?: boolean;
  } = {},
): void {
  assertCertificateAuthority(facts.certificate, options.requireAuthority ?? true);
  assertPrintParties(facts);
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
  /** Only when a stamp is stated. */
  stamp: string | null;
  /** Only when the printer is stated. */
  printedBy: string | null;
  /** Only when the publisher is stated. */
  publishedBy: string | null;
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

const STAMP_ROWS: Record<Exclude<Stamp, "none">, string> = {
  publisher_blind: "Blind stamp of the publisher",
  printer_blind: "Blind stamp of the printer",
  estate_back: "Estate stamp on the back",
};

/** The legal name the certificate row gives, since it is the company that issues it. */
const LAX_ISSUER_NAME = "London Art Exchange Ltd";

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

/** Hors commerce proofs were made not to be sold, so their listing always says so. */
const HORS_COMMERCE_NOTE = "originally not for sale";

function editionRow(run: EditionRunSpec): string {
  if (run.type === "proof") {
    const name = capitalise(PROOF_NAMES[run.proofType].singular);
    return run.proofType === "hc"
      ? `${name}, ${HORS_COMMERCE_NOTE}, one of ${run.size}`
      : `${name}, one of ${run.size}`;
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

function stampRow(stamp: Stamp | undefined): string | null {
  return stamp && stamp !== "none" ? STAMP_ROWS[stamp] : null;
}

function publishedByRow(published: Publisher | null | undefined): string | null {
  if (!published) return null;
  if (published.kind === "artist") return "The artist";
  return published.kind === "lax" ? LAX_ISSUER_NAME : published.name;
}

/** The sentence for a certificate that stands on a recorded authority; older rows keep the plain one. */
function authorityCertificateRow(
  certificate: Extract<Certificate, { kind: "included" }>,
): string | null {
  if (certificate.issuer !== "lax" || !certificate.authority) return null;
  const giver = certificate.authority.givenBy === "estate" ? "the estate's" : "the artist's";
  return `${certificateName(certificate.form)} of authenticity issued by ${LAX_ISSUER_NAME} on ${giver} written authority, ${certificateDelivery(certificate)}`;
}

function certificateRow(certificate: Certificate): string {
  if (certificate.kind === "none") return "No certificate of authenticity";
  const onAuthority = authorityCertificateRow(certificate);
  if (onAuthority) return onAuthority;
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

/** What a page can say about a run before staff have confirmed its facts. */
export function describeEditionRun(run: EditionRunSpec): { eyebrow: string; edition: string } {
  return { eyebrow: eyebrow(run), edition: editionRow(run) };
}

/**
 * How another run of the same image is named beside this one: "As an artist's proof",
 * "Unsigned, open edition", "Hand-signed, limited edition of 24". Without confirmed facts only the
 * run is named.
 */
export function describeAlsoAvailable(run: EditionRunSpec, facts: EditionFacts | null): string {
  if (run.type === "proof") {
    const noun = PROOF_NAMES[run.proofType].singular;
    return `As ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;
  }
  const name = runName(run);
  if (!facts) return name;
  return `${signatureShort(facts.signature)}, ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
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
  const horsCommerce = run.type === "proof" && run.proofType === "hc";
  return {
    eyebrow: eyebrow(run),
    rows: {
      edition: editionRow(run),
      signature: signatureRow(signature),
      number: numberRow(run, numbering),
      certificate: certificateRow(certificate),
      stamp: stampRow(facts.stamp),
      printedBy: facts.printedBy?.trim() || null,
      publishedBy: publishedByRow(facts.publishedBy),
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
        ...(horsCommerce ? [capitalise(HORS_COMMERCE_NOTE)] : []),
        signed,
        ...(numbering === "none" && !open ? ["Not numbered"] : []),
        ...(certificateText ? [certificateText] : []),
      ].join(" · ");
    },
    invoiceDetail: (print) => {
      const numbered = numberedPrintText(run, numbering, print);
      return [
        numbered && run.type !== "proof" ? `${name}, ${numbered.invoice}` : name,
        ...(horsCommerce ? [HORS_COMMERCE_NOTE] : []),
        ...(numbered && run.type === "proof" ? [numbered.invoice] : []),
        signatureForInvoice(signature),
        ...(certificate.kind === "included" ? ["with certificate of authenticity"] : []),
        ...(facts.printedBy?.trim() ? [`printed by ${facts.printedBy.trim()}`] : []),
      ].join(", ");
    },
  };
}
