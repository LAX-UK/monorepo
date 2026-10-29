import type { PublicOrganisationSubkind } from "@auction/validators";

/** One document LAX asks an organisation for. `label` names one of several "other" documents. */
export type DocumentSlot = {
  kind: string;
  /** Required when kind === other (canonical or free-form). */
  label?: string;
  title: string;
};

const ESTATE_LABELS = ["Probate document", "Executor ID", "Beneficiary list"] as const;

const KIND_TITLES: Record<string, string> = {
  companies_house_extract: "Companies House extract",
  vat_certificate: "VAT certificate",
  beneficial_owner_id: "Beneficial owner ID",
  provenance_sample: "Provenance sample",
  bank_statement: "Bank statement",
  other: "Other document",
};

/** The name a member reads for a document: its label when it has one, else its kind's title. */
export function orgDocumentTitle(kind: string, label?: string | null): string {
  const named = label?.trim();
  if (named) return named;
  return KIND_TITLES[kind] ?? "Supporting document";
}

/**
 * The documents asked of an organisation of `subkind`. Estates and "other" organisations have
 * fixed slots; every other type uses the kinds the API requires (`requiredKinds`).
 */
export function orgDocumentSlots(
  subkind: PublicOrganisationSubkind,
  requiredKinds: readonly string[],
): DocumentSlot[] {
  if (subkind === "estate") {
    return ESTATE_LABELS.map((label) => ({ kind: "other", label, title: label }));
  }
  if (subkind === "other") {
    return [{ kind: "other", title: "Supporting document" }];
  }
  return requiredKinds.map((kind) => ({ kind, title: orgDocumentTitle(kind) }));
}

/** Whether the subkind's slots come from the API, or are fixed here. */
export function orgDocumentSlotsNeedRequirements(subkind: PublicOrganisationSubkind): boolean {
  return subkind !== "estate" && subkind !== "other";
}
