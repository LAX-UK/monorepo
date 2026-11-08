import {
  type Certificate,
  type DescribedPrint,
  type EditionFacts,
  type Numbering,
  type Publisher,
  type Signature,
  type Stamp,
  assertEditionFacts,
  describeEditionFacts,
} from "./edition-facts.js";
import { type EditionRunSpec, type ProofsKept, assertValidRunSpec } from "./edition-run.js";
import { ShopDomainError } from "./shop-domain-error.js";

/**
 * What a buyer was told about a print when they paid: the run it belongs to and the facts staff
 * had confirmed. It is stored as JSON on the order line, so it keeps its meaning if the run's
 * facts are corrected later. Everything here is pure.
 */

export const EDITION_SNAPSHOT_VERSION = 1 as const;

/** The facts as stored in JSON: the confirmation date is an ISO string. */
export type PlainEditionFacts = {
  numbering: Numbering;
  signature: Signature;
  certificate: Certificate;
  stamp?: Stamp | undefined;
  printedBy?: string | null | undefined;
  publishedBy?: Publisher | null | undefined;
  confirmed: { by: string; at: string } | null;
};

export type EditionFactsSnapshot = {
  schemaVersion: typeof EDITION_SNAPSHOT_VERSION;
  run: EditionRunSpec;
  proofsKept: ProofsKept | null;
  facts: PlainEditionFacts | null;
};

/** A snapshot read back and checked: dates restored and the facts known to fit the run. */
export type ReadEditionSnapshot = {
  run: EditionRunSpec;
  proofsKept: ProofsKept | null;
  facts: EditionFacts | null;
};

/** Where the signed letter is kept stays with staff, so it is not kept on an order. */
function withoutLetterReference(certificate: Certificate): Certificate {
  if (certificate.kind !== "included" || !certificate.authority) return certificate;
  const { reference: _kept, ...authority } = certificate.authority;
  return { ...certificate, authority };
}

export function editionFactsToPlain(facts: EditionFacts | null): PlainEditionFacts | null {
  if (!facts) return null;
  return {
    numbering: facts.numbering,
    signature: facts.signature,
    certificate: withoutLetterReference(facts.certificate),
    ...(facts.stamp ? { stamp: facts.stamp } : {}),
    ...(facts.printedBy ? { printedBy: facts.printedBy } : {}),
    ...(facts.publishedBy ? { publishedBy: facts.publishedBy } : {}),
    confirmed: facts.confirmed
      ? { by: facts.confirmed.by, at: facts.confirmed.at.toISOString() }
      : null,
  };
}

export function createEditionSnapshot(input: {
  run: EditionRunSpec;
  proofsKept: ProofsKept | null;
  facts: EditionFacts | null;
}): EditionFactsSnapshot {
  return {
    schemaVersion: EDITION_SNAPSHOT_VERSION,
    run: input.run,
    proofsKept: input.proofsKept,
    facts: editionFactsToPlain(input.facts),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFacts(run: EditionRunSpec, raw: unknown): EditionFacts | null {
  if (!isRecord(raw)) return null;
  const confirmed = isRecord(raw.confirmed) ? raw.confirmed : null;
  const at = confirmed && typeof confirmed.at === "string" ? new Date(confirmed.at) : null;
  const facts = {
    numbering: raw.numbering,
    signature: raw.signature,
    certificate: raw.certificate,
    stamp: raw.stamp,
    printedBy: raw.printedBy,
    publishedBy: raw.publishedBy,
    confirmed:
      confirmed && typeof confirmed.by === "string" && at && !Number.isNaN(at.getTime())
        ? { by: confirmed.by, at }
        : null,
  } as EditionFacts;
  try {
    // What a buyer was told stays readable even when it predates the recorded authority.
    assertEditionFacts(run, facts, { requireAuthority: false });
    return facts;
  } catch (error) {
    if (error instanceof ShopDomainError) return null;
    throw error;
  }
}

/**
 * Reads a stored snapshot. Anything that is not a version 1 snapshot of a valid run is null, so a
 * reader falls back to the live facts instead of describing a print from damaged data. Facts that
 * do not fit their run are dropped on their own, leaving the run.
 */
export function readEditionSnapshot(raw: unknown): ReadEditionSnapshot | null {
  if (!isRecord(raw) || raw.schemaVersion !== EDITION_SNAPSHOT_VERSION) return null;
  if (!isRecord(raw.run) || typeof raw.run.type !== "string") return null;
  const run = raw.run as unknown as EditionRunSpec;
  try {
    assertValidRunSpec(run);
  } catch (error) {
    if (error instanceof ShopDomainError) return null;
    throw error;
  }
  return {
    run,
    proofsKept: isRecord(raw.proofsKept) ? (raw.proofsKept as unknown as ProofsKept) : null,
    facts: readFacts(run, raw.facts),
  };
}

/** The sentences a buyer reads for one print of a run. */
export type PrintDescription = {
  /** Your orders: "No. 7 of 24 · Hand-signed · Certificate from the artist". */
  summary: string;
  /** The invoice line detail: "Limited edition of 24, no. 7, signed by hand, with certificate of authenticity". */
  invoiceDetail: string;
};

/**
 * Describes a print from a snapshot. Null when the snapshot holds no facts, because then the only
 * honest sentence is the plain edition number the caller already has.
 */
export function describeSnapshotPrint(
  snapshot: ReadEditionSnapshot,
  print?: DescribedPrint,
): PrintDescription | null {
  if (!snapshot.facts) return null;
  const description = describeEditionFacts(snapshot.run, snapshot.facts, {
    ...(snapshot.proofsKept ? { proofsKept: snapshot.proofsKept } : {}),
  });
  return {
    summary: description.orderLine(print),
    invoiceDetail: description.invoiceDetail(print),
  };
}

/** What the buyer sees about a certificate that is, or is not yet, issued. */
export type CertificateStatus = {
  /** "Certificate of authenticity No. 7/24". */
  label: string;
  /** Says what to expect while the certificate is not issued; null once it is. */
  expectedNote: string | null;
};

const LEGACY_CERTIFICATE_NOTE = "Your certificate appears here once it has been issued.";

function numberedLabel(facts: EditionFacts | null, printLabel: string | null): string | null {
  const certificate = facts?.certificate;
  const numbered = facts !== null && facts.numbering !== "none";
  return numbered && certificate?.kind === "included" && certificate.numberedToMatch
    ? printLabel
    : null;
}

function arrivalNote(certificate: Extract<Certificate, { kind: "included" }>): string {
  if (certificate.form === "digital") {
    return "Your digital certificate is added here once your print is confirmed.";
  }
  if (certificate.arrives.kind === "with_print") return "Your certificate comes with your print.";
  const weeks = certificate.arrives.withinWeeks;
  return `Your certificate is sent separately, within ${weeks} ${weeks === 1 ? "week" : "weeks"} of delivery.`;
}

/**
 * The certificate row of a print. `facts` are what the buyer was promised (null when the order
 * has no recorded facts); `issued` is whether a certificate exists for the print. A print with
 * neither a promise nor an issued certificate has no row.
 */
export function describeCertificateStatus(input: {
  facts: EditionFacts | null;
  issued: boolean;
  printLabel: string | null;
  /** The shop's earlier flag that a certificate was expected, for prints with no recorded facts. */
  legacyExpected?: boolean;
}): CertificateStatus | null {
  const { issued } = input;
  const certificate = input.facts?.certificate ?? null;
  const number = numberedLabel(input.facts, input.printLabel);
  const label = number
    ? `Certificate of authenticity No. ${number}`
    : "Certificate of authenticity";
  if (issued) return { label, expectedNote: null };
  if (certificate?.kind === "included") {
    return { label, expectedNote: arrivalNote(certificate) };
  }
  if (certificate === null && input.legacyExpected) {
    return { label, expectedNote: LEGACY_CERTIFICATE_NOTE };
  }
  return null;
}
