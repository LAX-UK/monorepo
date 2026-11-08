import type { shopEditionFacts } from "@auction/db/schema";
import {
  type Certificate,
  type EditionFacts,
  type Publisher,
  ShopDomainError,
  type Signature,
} from "@auction/shop-domain";

type FactsRow = typeof shopEditionFacts.$inferSelect;
/** The facts a run's staff confirm; the certificate authority is recorded on its own. */
export type FactsColumns = Omit<
  FactsRow,
  | "artworkId"
  | "createdAt"
  | "updatedAt"
  | "certificateAuthorityReference"
  | "certificateAuthorityRecordedBy"
  | "certificateAuthorityRecordedAt"
>;

type SignatureColumns = Pick<FactsColumns, "signatureKind" | "signatureMedium" | "signaturePlace">;
type PartyColumns = Pick<
  FactsColumns,
  "stamp" | "printedBy" | "publishedByKind" | "publishedByName"
>;
type CertificateColumns = Omit<
  FactsColumns,
  keyof SignatureColumns | keyof PartyColumns | "numbering" | "confirmedBySubjectId" | "confirmedAt"
>;

function signatureToColumns(signature: Signature): SignatureColumns {
  switch (signature.kind) {
    case "hand_signed":
      return {
        signatureKind: "hand_signed",
        signatureMedium: signature.medium,
        signaturePlace: signature.place,
      };
    case "estate_signed":
      return {
        signatureKind: "estate_signed",
        signatureMedium: null,
        signaturePlace: signature.place,
      };
    default:
      return { signatureKind: signature.kind, signatureMedium: null, signaturePlace: null };
  }
}

function certificateToColumns(certificate: Certificate): CertificateColumns {
  if (certificate.kind === "none") {
    return {
      certificateKind: "none",
      certificateIssuer: null,
      certificateForm: null,
      certificateArrives: null,
      certificateWithinWeeks: null,
      certificateNumberedToMatch: null,
      certificateNumberedToMatchReason: null,
      certificateAuthorityGivenBy: null,
      certificateAuthorityDatedOn: null,
    };
  }
  return {
    certificateKind: "included",
    certificateIssuer: certificate.issuer,
    certificateForm: certificate.form,
    certificateArrives: certificate.arrives.kind,
    certificateWithinWeeks:
      certificate.arrives.kind === "separately" ? certificate.arrives.withinWeeks : null,
    certificateNumberedToMatch: certificate.numberedToMatch,
    certificateNumberedToMatchReason: certificate.numberedToMatchReason?.trim() || null,
    certificateAuthorityGivenBy: certificate.authority?.givenBy ?? null,
    certificateAuthorityDatedOn: certificate.authority?.datedOn ?? null,
  };
}

function partiesToColumns(facts: EditionFacts): PartyColumns {
  const published = facts.publishedBy;
  return {
    stamp: facts.stamp ?? "none",
    printedBy: facts.printedBy?.trim() || null,
    publishedByKind: published?.kind ?? null,
    publishedByName: published?.kind === "named" ? published.name.trim() : null,
  };
}

export function factsToColumns(facts: EditionFacts): FactsColumns {
  return {
    numbering: facts.numbering,
    ...signatureToColumns(facts.signature),
    ...certificateToColumns(facts.certificate),
    ...partiesToColumns(facts),
    confirmedBySubjectId: facts.confirmed?.by ?? null,
    confirmedAt: facts.confirmed?.at ?? null,
  };
}

function signatureFromColumns(row: FactsColumns): Signature {
  switch (row.signatureKind) {
    case "hand_signed":
      if (!row.signatureMedium || !row.signaturePlace) break;
      return { kind: "hand_signed", medium: row.signatureMedium, place: row.signaturePlace };
    case "estate_signed":
      if (!row.signaturePlace) break;
      return { kind: "estate_signed", place: row.signaturePlace };
    default:
      return { kind: row.signatureKind };
  }
  throw new ShopDomainError("The stored signature is incomplete");
}

function certificateFromColumns(
  row: FactsColumns & Partial<Pick<FactsRow, "certificateAuthorityReference">>,
): Certificate {
  if (row.certificateKind === "none") return { kind: "none" };
  if (
    !row.certificateIssuer ||
    !row.certificateForm ||
    !row.certificateArrives ||
    row.certificateNumberedToMatch === null
  ) {
    throw new ShopDomainError("The stored certificate is incomplete");
  }
  const arrives =
    row.certificateArrives === "separately"
      ? { kind: "separately" as const, withinWeeks: row.certificateWithinWeeks ?? 0 }
      : { kind: "with_print" as const };
  return {
    kind: "included",
    issuer: row.certificateIssuer,
    form: row.certificateForm,
    arrives,
    numberedToMatch: row.certificateNumberedToMatch,
    ...(row.certificateNumberedToMatchReason
      ? { numberedToMatchReason: row.certificateNumberedToMatchReason }
      : {}),
    ...(row.certificateAuthorityGivenBy && row.certificateAuthorityDatedOn
      ? {
          authority: {
            givenBy: row.certificateAuthorityGivenBy,
            datedOn: row.certificateAuthorityDatedOn,
            ...(row.certificateAuthorityReference
              ? { reference: row.certificateAuthorityReference }
              : {}),
          },
        }
      : {}),
  };
}

function publishedByFromColumns(row: FactsColumns): Publisher | null {
  switch (row.publishedByKind) {
    case "artist":
    case "lax":
      return { kind: row.publishedByKind };
    case "named":
      if (!row.publishedByName) throw new ShopDomainError("The stored publisher has no name");
      return { kind: "named", name: row.publishedByName };
    default:
      return null;
  }
}

export function factsFromColumns(
  row: FactsColumns & Partial<Pick<FactsRow, "certificateAuthorityReference">>,
): EditionFacts {
  return {
    numbering: row.numbering,
    signature: signatureFromColumns(row),
    certificate: certificateFromColumns(row),
    stamp: row.stamp,
    printedBy: row.printedBy,
    publishedBy: publishedByFromColumns(row),
    confirmed:
      row.confirmedBySubjectId && row.confirmedAt
        ? { by: row.confirmedBySubjectId, at: row.confirmedAt }
        : null,
  };
}
