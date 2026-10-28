import type { shopEditionFacts } from "@auction/db/schema";
import {
  type Certificate,
  type EditionFacts,
  ShopDomainError,
  type Signature,
} from "@auction/shop-domain";

type FactsRow = typeof shopEditionFacts.$inferSelect;
export type FactsColumns = Omit<FactsRow, "artworkId" | "createdAt" | "updatedAt">;

type SignatureColumns = Pick<FactsColumns, "signatureKind" | "signatureMedium" | "signaturePlace">;
type CertificateColumns = Omit<
  FactsColumns,
  keyof SignatureColumns | "numbering" | "confirmedBySubjectId" | "confirmedAt"
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
  };
}

export function factsToColumns(facts: EditionFacts): FactsColumns {
  return {
    numbering: facts.numbering,
    ...signatureToColumns(facts.signature),
    ...certificateToColumns(facts.certificate),
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

function certificateFromColumns(row: FactsColumns): Certificate {
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
  };
}

export function factsFromColumns(row: FactsColumns): EditionFacts {
  return {
    numbering: row.numbering,
    signature: signatureFromColumns(row),
    certificate: certificateFromColumns(row),
    confirmed:
      row.confirmedBySubjectId && row.confirmedAt
        ? { by: row.confirmedBySubjectId, at: row.confirmedAt }
        : null,
  };
}
