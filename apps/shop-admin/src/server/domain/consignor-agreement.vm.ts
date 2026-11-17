import type { AdminConsignorAgreement, ConsignmentPlaceContract } from "@auction/shop-contracts";
import { formatBpsAsPercent, formatStaffDate, formatStaffMoney } from "@auction/staff-ui";

/*
 * How a consignor's agreements read on their client page (ZI-5, decision pack 17 November 2026,
 * section 1, option B), and the add / replace form's values. shop-api checks every rule again
 * and names each field it refuses; these only shape what staff type into what the API takes.
 */

export const CONSIGNMENT_PLACES: readonly ConsignmentPlaceContract[] = [
  "lax_bid",
  "lax_art",
  "private_sale",
];

export const PLACE_LABELS: Record<ConsignmentPlaceContract, string> = {
  lax_bid: "LAX Bid",
  lax_art: "lax.art",
  private_sale: "Private sale",
};

/** "LAX Bid, lax.art and private sale". */
export function placesSentence(places: readonly ConsignmentPlaceContract[]): string {
  const words = CONSIGNMENT_PLACES.filter((place) => places.includes(place)).map((place, index) =>
    // "LAX Bid" and "lax.art" are names; "private sale" is lower case mid-sentence.
    index > 0 && place === "private_sale" ? "private sale" : PLACE_LABELS[place],
  );
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/**
 * Where an agreement stands on `today` (a London day): in force, not started yet, past its end
 * date, or retired. A replaced version is not listed.
 */
export type AgreementState = "in_force" | "not_started" | "expired" | "retired";

export function agreementState(
  agreement: Pick<AdminConsignorAgreement, "status" | "startsOn" | "endsOn">,
  today: string,
): AgreementState {
  if (agreement.status !== "current") return "retired";
  if (agreement.startsOn > today) return "not_started";
  if (agreement.endsOn !== null && agreement.endsOn < today) return "expired";
  return "in_force";
}

export const AGREEMENT_STATE_BADGES: Record<
  AgreementState,
  { label: string; tone: "success" | "info" | "neutral" | "warning" }
> = {
  in_force: { label: "In force", tone: "success" },
  not_started: { label: "Not started", tone: "info" },
  expired: { label: "Expired", tone: "warning" },
  retired: { label: "Retired", tone: "neutral" },
};

/** "3 Mar 2026 to 2 Mar 2027", or "From 3 Mar 2026, no end date". */
export function agreementDates(agreement: Pick<AdminConsignorAgreement, "startsOn" | "endsOn">) {
  const start = formatStaffDate(agreement.startsOn);
  return agreement.endsOn
    ? `${start} to ${formatStaffDate(agreement.endsOn)}`
    : `From ${start}, no end date`;
}

export function lowestPriceText(pence: number | null): string {
  return pence === null ? "None agreed" : formatStaffMoney(pence);
}

export function commissionText(basisPoints: number | null): string {
  return basisPoints === null ? "Not recorded" : formatBpsAsPercent(basisPoints);
}

/**
 * The order the page lists them in: in force first, then not started, expired and retired;
 * within each, the newest first. The API sends current before retired; this also puts expired
 * agreements below the ones that still cover anything.
 */
export function sortAgreements(
  agreements: readonly AdminConsignorAgreement[],
  today: string,
): AdminConsignorAgreement[] {
  const rank: Record<AgreementState, number> = {
    in_force: 0,
    not_started: 1,
    expired: 2,
    retired: 3,
  };
  return [...agreements].sort(
    (a, b) =>
      rank[agreementState(a, today)] - rank[agreementState(b, today)] ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

// ---------------------------------------------------------------------------------------------
// The add / replace form
// ---------------------------------------------------------------------------------------------

export type AgreementFormField =
  | "places"
  | "startsOn"
  | "endsOn"
  | "lowestPricePence"
  | "commissionBasisPoints"
  | "signedFileKey"
  | "note";

export const AGREEMENT_FIELD_LABELS: Record<AgreementFormField, string> = {
  places: "Places",
  startsOn: "Starts",
  endsOn: "Ends",
  lowestPricePence: "Lowest price",
  commissionBasisPoints: "Commission",
  signedFileKey: "Signed agreement",
  note: "Note",
};

export const AGREEMENT_FORM_FIELDS = Object.keys(AGREEMENT_FIELD_LABELS) as AgreementFormField[];

export const AGREEMENT_NOTE_MAX_LENGTH = 1000;

export type AgreementFormValues = {
  places: ConsignmentPlaceContract[];
  startsOn: string | null;
  endsOn: string | null;
  /** Whole pence; null when empty or not yet an amount. */
  lowestPricePence: number | null;
  /** What is typed in the price field, so "not an amount" can be told from empty. */
  lowestPriceTyped: boolean;
  /** A decimal rate ("0.25"), "" when empty, null while the text is not a number. */
  commissionRate: string | null;
  signedFileKey: string | null;
  note: string;
};

/** The form for a new agreement, or for the next version of `agreement` (its terms to start). */
export function agreementFormValues(
  agreement: AdminConsignorAgreement | null,
): AgreementFormValues {
  if (!agreement) {
    return {
      places: [],
      startsOn: null,
      endsOn: null,
      lowestPricePence: null,
      lowestPriceTyped: false,
      commissionRate: "",
      signedFileKey: null,
      note: "",
    };
  }
  return {
    places: [...agreement.places],
    startsOn: agreement.startsOn,
    endsOn: agreement.endsOn,
    lowestPricePence: agreement.lowestPricePence,
    lowestPriceTyped: agreement.lowestPricePence !== null,
    commissionRate:
      agreement.commissionBasisPoints === null
        ? ""
        : String(agreement.commissionBasisPoints / 10_000),
    signedFileKey: agreement.signedFileKey,
    note: agreement.note ?? "",
  };
}

export type AgreementFormBody = {
  places: ConsignmentPlaceContract[];
  startsOn: string;
  endsOn: string | null;
  lowestPricePence: number | null;
  commissionBasisPoints: number | null;
  signedFileKey: string;
  note: string | null;
};

export type AgreementFormErrors = Partial<Record<AgreementFormField, string>>;

/** A rate as basis points, when it is a whole number of them from 0 to 10000. */
function rateToBasisPoints(rate: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(rate)) return null;
  const basisPoints = Number(rate) * 10_000;
  const rounded = Math.round(basisPoints);
  if (Math.abs(basisPoints - rounded) > 1e-6 || rounded > 10_000) return null;
  return rounded;
}

/**
 * The body the API takes, or what is missing or not a value yet, beside each field. Only the
 * checks a person needs before sending: whether the terms hold together is shop-api's to say.
 */
export function checkAgreementForm(
  values: AgreementFormValues,
): { ok: true; body: AgreementFormBody } | { ok: false; errors: AgreementFormErrors } {
  const errors: AgreementFormErrors = {};
  if (values.places.length === 0) errors.places = "Choose at least one place.";
  if (!values.startsOn) errors.startsOn = "Enter the day the agreement starts.";
  if (values.startsOn && values.endsOn && values.endsOn < values.startsOn)
    errors.endsOn = "The end date must be on or after the start date.";
  if (values.lowestPriceTyped && values.lowestPricePence === null)
    errors.lowestPricePence = "Enter the lowest price in pounds, such as 2,000.";
  else if (values.lowestPricePence !== null && values.lowestPricePence <= 0)
    errors.lowestPricePence = "Enter a lowest price above £0, or leave it empty.";
  const commissionBasisPoints =
    values.commissionRate === "" ? null : rateToBasisPoints(values.commissionRate ?? "x");
  if (values.commissionRate !== "" && commissionBasisPoints === null)
    errors.commissionBasisPoints = "Enter a commission from 0% to 100%, such as 25.";
  if (!values.signedFileKey) errors.signedFileKey = "Upload the signed agreement.";
  if (values.note.trim().length > AGREEMENT_NOTE_MAX_LENGTH)
    errors.note = `Keep the note to ${AGREEMENT_NOTE_MAX_LENGTH} characters or fewer.`;
  if (Object.keys(errors).length > 0 || !values.startsOn || !values.signedFileKey)
    return { ok: false, errors };
  return {
    ok: true,
    body: {
      places: CONSIGNMENT_PLACES.filter((place) => values.places.includes(place)),
      startsOn: values.startsOn,
      endsOn: values.endsOn,
      lowestPricePence: values.lowestPricePence,
      commissionBasisPoints,
      signedFileKey: values.signedFileKey,
      note: values.note.trim() || null,
    },
  };
}

/** The fields shop-api named in a 400 (`issues`), each with its sentence. */
export function fieldErrorsFromIssues(issues: readonly unknown[] | undefined): AgreementFormErrors {
  const errors: AgreementFormErrors = {};
  for (const issue of issues ?? []) {
    if (!issue || typeof issue !== "object") continue;
    const { field, message } = issue as { field?: unknown; message?: unknown };
    if (
      typeof field === "string" &&
      typeof message === "string" &&
      (AGREEMENT_FORM_FIELDS as string[]).includes(field) &&
      !errors[field as AgreementFormField]
    ) {
      errors[field as AgreementFormField] = message;
    }
  }
  return errors;
}

export const AGREEMENT_FILE_ACCEPT = "application/pdf,image/jpeg,image/png";
export const AGREEMENT_FILE_MAX_BYTES = 20 * 1024 * 1024;

/** Why a chosen file cannot be sent, before any upload starts; null when it can. */
export function agreementFileProblem(file: { type: string; size: number }): string | null {
  if (!AGREEMENT_FILE_ACCEPT.split(",").includes(file.type))
    return "Choose a PDF, JPEG or PNG file.";
  if (file.size > AGREEMENT_FILE_MAX_BYTES) return "Choose a file of 20 MB or less.";
  if (file.size === 0) return "This file is empty. Choose the signed agreement.";
  return null;
}
