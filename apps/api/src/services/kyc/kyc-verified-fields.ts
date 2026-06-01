import type { KycVerifiedFields } from "./kyc-decision-processor.js";

/**
 * Veriff Data Extraction fields arrive either as a plain string or, in some
 * payload shapes, as a `{ value }` wrapper. `readStr` normalizes both to a
 * trimmed string (or null) so extraction is resilient to either shape.
 */
type VeriffField = string | number | null | undefined | { value?: string | number | null };

function readStr(field: VeriffField): string | null {
  if (field == null) return null;
  if (typeof field === "string") {
    const trimmed = field.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof field === "number") {
    return String(field);
  }
  if (typeof field === "object" && "value" in field) {
    return readStr(field.value);
  }
  return null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type VeriffRecord = Record<string, unknown> | null | undefined;

function field(record: VeriffRecord, key: string): VeriffField {
  if (record == null) return null;
  return record[key] as VeriffField;
}

export function extractVerifiedFieldsFromVeriffDecision(payload: {
  person?: VeriffRecord;
  document?: VeriffRecord;
  riskScore?: VeriffField;
  ipCountry?: VeriffField;
}): KycVerifiedFields {
  const person = payload.person ?? null;
  const document = payload.document ?? null;
  const docNumber = readStr(field(document, "number"));
  const dob = readStr(field(person, "dateOfBirth"));

  return {
    verifiedFirstName: readStr(field(person, "firstName")),
    verifiedLastName: readStr(field(person, "lastName")),
    verifiedDateOfBirth: parseDate(dob),
    verifiedIdNumberLast4: docNumber && docNumber.length >= 4 ? docNumber.slice(-4) : null,
    verifiedIdCountry: readStr(field(document, "country")),
    verifiedIdType: readStr(field(document, "type")),
    verifiedIdExpiry: parseDate(readStr(field(document, "validUntil"))),
    verifiedGender: readStr(field(person, "gender")),
    verifiedNationality: readStr(field(person, "nationality")),
    verifiedCitizenship: readStr(field(person, "citizenship")),
    verifiedPlaceOfBirth: readStr(field(person, "placeOfBirth")),
    verifiedYearOfBirth: readStr(field(person, "yearOfBirth")) ?? (dob ? dob.slice(0, 4) : null),
    // Full document number is PII; persisted only because the Data Extraction
    // add-on is enabled and access is restricted to compliance roles.
    verifiedIdNumber: docNumber,
    verifiedDocState: readStr(field(document, "state")),
    verifiedIdValidFrom: parseDate(readStr(field(document, "validFrom"))),
    decisionRiskScore: readStr(payload.riskScore),
    decisionIpCountry: readStr(payload.ipCountry),
  };
}
