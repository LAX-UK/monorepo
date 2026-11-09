import {
  type AdminEditionFacts,
  type AdminEditionRunSpec,
  type AdminProofsKept,
  CERTIFICATE_WEEKS_MAX,
} from "@auction/shop-contracts";
import {
  type EditionFactsDescription,
  ShopDomainError,
  assertEditionFacts,
  describeEditionFacts,
  isOpenRun,
  runSize,
} from "@auction/shop-domain";

/*
 * The edition facts form: signature, numbering and certificate, with nothing preselected so a
 * default never becomes a false claim. Kept apart from the components so the rules and the
 * "Shoppers will see" preview are tested without rendering. The wording shoppers read comes only
 * from the shop domain's describer.
 */

export type SignatureChoice = AdminEditionFacts["signature"]["kind"];
export type NumberingChoice = AdminEditionFacts["numbering"];
type Included = Extract<AdminEditionFacts["certificate"], { kind: "included" }>;

export type StampChoice = NonNullable<AdminEditionFacts["stamp"]>;
export type AuthorityGiverChoice = "artist" | "estate";

/** The "Published by" select: no value says nothing; the others are the artist, LAX or a listed name. */
export const PUBLISHED_BY_ARTIST = "@artist";
export const PUBLISHED_BY_LAX = "@lax";
const PUBLISHED_BY_NAMED = "name:";

export function publishedByValue(published: AdminEditionFacts["publishedBy"]): string {
  if (!published) return "";
  if (published.kind === "artist") return PUBLISHED_BY_ARTIST;
  return published.kind === "lax" ? PUBLISHED_BY_LAX : `${PUBLISHED_BY_NAMED}${published.name}`;
}

function publishedByInput(value: string): NonNullable<AdminEditionFacts["publishedBy"]> | null {
  if (value === PUBLISHED_BY_ARTIST) return { kind: "artist" };
  if (value === PUBLISHED_BY_LAX) return { kind: "lax" };
  return value.startsWith(PUBLISHED_BY_NAMED)
    ? { kind: "named", name: value.slice(PUBLISHED_BY_NAMED.length) }
    : null;
}

export function publishedByNamedValue(name: string): string {
  return `${PUBLISHED_BY_NAMED}${name}`;
}

export type FactsFormValues = {
  signature: SignatureChoice | null;
  medium: "pencil" | "ink" | null;
  place: "front_lower_margin" | "back" | null;
  numbering: NumberingChoice | null;
  certificate: "none" | "included" | null;
  issuer: Included["issuer"] | null;
  form: Included["form"] | null;
  arrives: "with_print" | "separately" | null;
  withinWeeksText: string;
  /** Ticked by default once a certificate is chosen for a numbered run (rule 7). */
  numberedToMatch: boolean;
  numberedToMatchReason: string;
  /** The written authority behind a certificate London Art Exchange issues. */
  authorityGivenBy: AuthorityGiverChoice | null;
  /** The date of the letter, YYYY-MM-DD. */
  authorityDatedOn: string;
  /** Where the signed letter is kept. */
  authorityReference: string;
  /** "No stamp" says nothing. */
  stamp: StampChoice;
  /** A name from Settings; empty says nothing. */
  printedBy: string;
  /** See publishedByValue; empty says nothing. */
  publishedBy: string;
  /** "I have checked these facts against the print or the publisher's records". */
  confirmed: boolean;
};

export const FACTS_FORM_FIELDS = [
  "signature",
  "medium",
  "place",
  "numbering",
  "certificate",
  "issuer",
  "form",
  "arrives",
  "withinWeeks",
  "numberedToMatchReason",
  "authorityGivenBy",
  "authorityDatedOn",
  "authorityReference",
] as const;
export type FactsFormField = (typeof FACTS_FORM_FIELDS)[number];

export function factsFieldId(field: FactsFormField | "confirmed"): string {
  return `facts-${field}`;
}

export function emptyFactsForm(): FactsFormValues {
  return {
    signature: null,
    medium: null,
    place: null,
    numbering: null,
    certificate: null,
    issuer: null,
    form: null,
    arrives: null,
    withinWeeksText: "",
    numberedToMatch: true,
    numberedToMatchReason: "",
    authorityGivenBy: null,
    authorityDatedOn: "",
    authorityReference: "",
    stamp: "none",
    printedBy: "",
    publishedBy: "",
    confirmed: false,
  };
}

/** The form for stored facts; an open run's numbering is always "Not numbered". */
export function factsFormValues(
  facts: AdminEditionFacts | null,
  confirmed: boolean,
): FactsFormValues {
  if (!facts) return emptyFactsForm();
  const { signature, certificate } = facts;
  return {
    signature: signature.kind,
    medium: signature.kind === "hand_signed" ? signature.medium : null,
    place:
      signature.kind === "hand_signed" || signature.kind === "estate_signed"
        ? signature.place
        : null,
    numbering: facts.numbering,
    certificate: certificate.kind,
    issuer: certificate.kind === "included" ? certificate.issuer : null,
    form: certificate.kind === "included" ? certificate.form : null,
    arrives: certificate.kind === "included" ? certificate.arrives.kind : null,
    withinWeeksText:
      certificate.kind === "included" && certificate.arrives.kind === "separately"
        ? String(certificate.arrives.withinWeeks)
        : "",
    numberedToMatch: certificate.kind === "included" ? certificate.numberedToMatch : true,
    numberedToMatchReason:
      certificate.kind === "included" ? (certificate.numberedToMatchReason ?? "") : "",
    authorityGivenBy:
      certificate.kind === "included" ? (certificate.authority?.givenBy ?? null) : null,
    authorityDatedOn: certificate.kind === "included" ? (certificate.authority?.datedOn ?? "") : "",
    authorityReference:
      certificate.kind === "included" ? (certificate.authority?.reference ?? "") : "",
    stamp: facts.stamp ?? "none",
    printedBy: facts.printedBy ?? "",
    publishedBy: publishedByValue(facts.publishedBy),
    confirmed,
  };
}

/** Open editions are never numbered, so their numbering is fixed (rule 5). */
export function withRun(
  values: FactsFormValues,
  spec: AdminEditionRunSpec | null,
): FactsFormValues {
  if (spec && isOpenRun(spec) && values.numbering !== "none") {
    return { ...values, numbering: "none" };
  }
  return values;
}

const NUMBERED_SIGNATURE_PLACE = new Set<SignatureChoice>(["hand_signed", "estate_signed"]);

export function signatureNeedsPlace(signature: SignatureChoice | null): boolean {
  return signature !== null && NUMBERED_SIGNATURE_PLACE.has(signature);
}

/** London Art Exchange issues this certificate, so it needs the written authority behind it. */
export function certificateNeedsAuthority(values: FactsFormValues): boolean {
  return values.certificate === "included" && values.issuer === "lax";
}

/** A digital certificate is issued to LAX Account, so when it arrives is not asked. */
export function certificateNeedsArrival(values: FactsFormValues): boolean {
  return values.certificate === "included" && values.form !== null && values.form !== "digital";
}

function weeks(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Every problem, keyed by field, in the wording staff see beside the field and in the summary.
 * Mirrors rules 5 to 8, which the API applies again.
 */
export function validateFactsForm(
  values: FactsFormValues,
  spec: AdminEditionRunSpec | null,
): Partial<Record<FactsFormField, string>> {
  const errors: Partial<Record<FactsFormField, string>> = {};
  if (!values.signature) errors.signature = "Choose how the prints are signed";
  if (values.signature === "hand_signed" && !values.medium) {
    errors.medium = "Say what the signature is written in";
  }
  if (signatureNeedsPlace(values.signature) && !values.place) {
    errors.place = "Say where the signature is";
  }
  if (!values.numbering) errors.numbering = "Choose how the prints are numbered";
  else if (spec && isOpenRun(spec) && values.numbering !== "none") {
    errors.numbering = "Open editions are not numbered";
  }
  if (!values.certificate)
    errors.certificate = "Choose whether a certificate comes with the prints";
  if (values.certificate === "included") {
    if (!values.issuer) errors.issuer = "Choose who issues the certificate";
    if (!values.form) errors.form = "Choose whether the certificate is paper, digital or both";
    if (certificateNeedsArrival(values)) {
      if (!values.arrives) errors.arrives = "Say when the certificate arrives";
      if (values.arrives === "separately") {
        const value = weeks(values.withinWeeksText);
        if (value === null || value < 1 || value > CERTIFICATE_WEEKS_MAX) {
          errors.withinWeeks = `Enter the weeks it takes, 1 to ${CERTIFICATE_WEEKS_MAX}`;
        }
      }
    }
  }
  if (certificateNeedsAuthority(values)) {
    if (!values.authorityGivenBy) {
      errors.authorityGivenBy = "Say whether the artist or their estate gave the authority";
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.authorityDatedOn)) {
      errors.authorityDatedOn = "Enter the date of the letter";
    }
    if (!values.authorityReference.trim()) {
      errors.authorityReference = "Say where the signed letter is kept";
    }
  }
  const numbered = values.numbering === "on_print" || values.numbering === "on_certificate";
  if (
    values.numbering === "on_certificate" &&
    (values.certificate !== "included" || !values.numberedToMatch)
  ) {
    errors.numbering = "A number on the certificate needs a certificate that carries the number";
  }
  if (
    numbered &&
    values.numbering !== "on_certificate" &&
    values.certificate === "included" &&
    !values.numberedToMatch &&
    !values.numberedToMatchReason.trim()
  ) {
    errors.numberedToMatchReason = "Say why the certificate is not numbered to match";
  }
  return errors;
}

export function factsErrorSummary(errors: Partial<Record<FactsFormField, string>>) {
  return FACTS_FORM_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: factsFieldId(field), message }] : [];
  });
}

/** The facts as the API takes them, or null while something is missing. */
export function factsInput(values: FactsFormValues): AdminEditionFacts | null {
  const { signature, numbering, certificate } = values;
  if (!signature || !numbering || !certificate) return null;
  let signatureInput: AdminEditionFacts["signature"];
  if (signature === "hand_signed") {
    if (!values.medium || !values.place) return null;
    signatureInput = { kind: "hand_signed", medium: values.medium, place: values.place };
  } else if (signature === "estate_signed") {
    if (!values.place) return null;
    signatureInput = { kind: "estate_signed", place: values.place };
  } else {
    signatureInput = { kind: signature };
  }
  const published = publishedByInput(values.publishedBy);
  const stated = {
    ...(values.stamp !== "none" ? { stamp: values.stamp } : {}),
    ...(values.printedBy.trim() ? { printedBy: values.printedBy.trim() } : {}),
    ...(published ? { publishedBy: published } : {}),
  } satisfies Partial<AdminEditionFacts>;
  if (certificate === "none") {
    return { numbering, signature: signatureInput, certificate: { kind: "none" }, ...stated };
  }
  if (!values.issuer || !values.form) return null;
  const authority =
    values.issuer === "lax"
      ? values.authorityGivenBy && values.authorityDatedOn && values.authorityReference.trim()
        ? {
            authority: {
              givenBy: values.authorityGivenBy,
              datedOn: values.authorityDatedOn,
              reference: values.authorityReference.trim(),
            },
          }
        : null
      : {};
  if (!authority) return null;
  const separately = certificateNeedsArrival(values) && values.arrives === "separately";
  if (certificateNeedsArrival(values) && !values.arrives) return null;
  const withinWeeks = weeks(values.withinWeeksText);
  if (separately && withinWeeks === null) return null;
  const numbered = numbering !== "none";
  const reason = values.numberedToMatchReason.trim();
  return {
    numbering,
    signature: signatureInput,
    certificate: {
      kind: "included",
      issuer: values.issuer,
      form: values.form,
      arrives:
        separately && withinWeeks !== null
          ? { kind: "separately", withinWeeks }
          : { kind: "with_print" },
      // An unnumbered run has no number to match; the certificate never claims one.
      numberedToMatch: numbered ? values.numberedToMatch : false,
      ...(numbered && !values.numberedToMatch && reason ? { numberedToMatchReason: reason } : {}),
      ...authority,
    },
    ...stated,
  };
}

export type FactsPreview =
  | { state: "partial"; edition: string; message: string }
  | {
      state: "complete";
      description: EditionFactsDescription;
      /** The order line once paid, for an example print ("No. 7 of 24"). */
      orderLine: string;
    };

function editionLine(spec: AdminEditionRunSpec): string {
  const size = runSize(spec);
  if (spec.type === "proof") {
    return describeEditionFacts(spec, {
      numbering: "none",
      signature: { kind: "unsigned" },
      certificate: { kind: "none" },
      confirmed: null,
    }).rows.edition;
  }
  return size === null ? "Open edition" : `Limited edition of ${size}`;
}

/**
 * What shoppers will see: the edition row alone until every fact is chosen, then the full
 * wording from the shop domain's describer, the card line and an example order line.
 */
export function factsPreview(
  values: FactsFormValues,
  spec: AdminEditionRunSpec,
  proofsKept?: AdminProofsKept,
): FactsPreview {
  const input = factsInput(values);
  if (!input) {
    return {
      state: "partial",
      edition: editionLine(spec),
      message: "Choose the signature, numbering and certificate to see the full wording.",
    };
  }
  const facts = { ...input, confirmed: null };
  try {
    assertEditionFacts(spec, facts);
  } catch (error) {
    if (!(error instanceof ShopDomainError)) throw error;
    return {
      state: "partial",
      edition: editionLine(spec),
      message: "The preview appears once the facts are consistent.",
    };
  }
  const description = describeEditionFacts(spec, facts, proofsKept ? { proofsKept } : {});
  const size = runSize(spec);
  const example =
    spec.type === "proof"
      ? { proofNumber: 1 }
      : size === null
        ? {}
        : { editionNumber: Math.min(7, size) };
  return { state: "complete", description, orderLine: description.orderLine(example) };
}

export function isFactsFormDirty(values: FactsFormValues, baseline: FactsFormValues): boolean {
  return JSON.stringify(values) !== JSON.stringify(baseline);
}
