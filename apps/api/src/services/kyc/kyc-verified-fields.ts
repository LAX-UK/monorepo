import type { KycVerifiedFields } from "./kyc-decision-processor.js";

type VeriffPerson = {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
};

type VeriffDocument = {
  number?: string | null;
  type?: string | null;
  country?: string | null;
  validUntil?: string | null;
};

export function extractVerifiedFieldsFromVeriffDecision(payload: {
  person?: VeriffPerson | null;
  document?: VeriffDocument | null;
}): KycVerifiedFields {
  const person = payload.person ?? null;
  const document = payload.document ?? null;
  const docNumber = document?.number ?? null;

  return {
    verifiedFirstName: person?.firstName ?? null,
    verifiedLastName: person?.lastName ?? null,
    verifiedDateOfBirth: person?.dateOfBirth ? new Date(person.dateOfBirth) : null,
    verifiedIdNumberLast4: docNumber && docNumber.length >= 4 ? docNumber.slice(-4) : null,
    verifiedIdCountry: document?.country ?? null,
    verifiedIdType: document?.type ?? null,
    verifiedIdExpiry: document?.validUntil ? new Date(document.validUntil) : null,
  };
}
