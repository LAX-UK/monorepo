import type { AdminPrintException, AdminSetPrintApartBody } from "@auction/shop-contracts";
import {
  type ConditionNote,
  type RemarqueMedium,
  type RemarquePlace,
  type SetApartPrint,
  assertPrintException,
  describePrintException,
  setApartPrintOf,
} from "@auction/shop-domain";
import { parseArtworkPrice } from "./artwork-form";

/*
 * "Set this print apart": what is different about one print, from fixed choices, and the price it
 * sells for on its own. The same rule the API applies is applied here first, so most mistakes are
 * caught before the request is sent.
 */

type SignatureKind = NonNullable<AdminPrintException["signature"]>["kind"];
type SignatureMedium = "pencil" | "ink";
type SignaturePlace = "front_lower_margin" | "back";

export type PrintApartValues = {
  remarque: boolean;
  remarqueMedium: RemarqueMedium | "";
  remarquePlace: RemarquePlace | "";
  dedicated: boolean;
  signedDifferently: boolean;
  signatureKind: SignatureKind | "";
  signatureMedium: SignatureMedium | "";
  signaturePlace: SignaturePlace | "";
  condition: boolean;
  conditionNote: ConditionNote | "";
  priceText: string;
};

export type PrintApartField =
  | "difference"
  | "remarqueMedium"
  | "remarquePlace"
  | "signatureKind"
  | "signatureMedium"
  | "signaturePlace"
  | "conditionNote"
  | "price";

export const PRINT_APART_FIELDS: readonly PrintApartField[] = [
  "difference",
  "remarqueMedium",
  "remarquePlace",
  "signatureKind",
  "signatureMedium",
  "signaturePlace",
  "conditionNote",
  "price",
];

export function printApartFieldId(field: PrintApartField): string {
  return `print-apart-${field}`;
}

export function emptyPrintApartForm(): PrintApartValues {
  return {
    remarque: false,
    remarqueMedium: "",
    remarquePlace: "",
    dedicated: false,
    signedDifferently: false,
    signatureKind: "",
    signatureMedium: "",
    signaturePlace: "",
    condition: false,
    conditionNote: "",
    priceText: "",
  };
}

type Run = { signature: NonNullable<AdminPrintException["signature"]> };

function signatureOf(values: PrintApartValues): AdminPrintException["signature"] | null {
  switch (values.signatureKind) {
    case "hand_signed":
      return values.signatureMedium && values.signaturePlace
        ? { kind: "hand_signed", medium: values.signatureMedium, place: values.signaturePlace }
        : null;
    case "estate_signed":
      return values.signaturePlace ? { kind: "estate_signed", place: values.signaturePlace } : null;
    case "plate_signed":
    case "estate_stamped":
    case "unsigned":
      return { kind: values.signatureKind };
    default:
      return null;
  }
}

export function signatureNeedsMedium(kind: SignatureKind | ""): boolean {
  return kind === "hand_signed";
}

export function signatureNeedsPlace(kind: SignatureKind | ""): boolean {
  return kind === "hand_signed" || kind === "estate_signed";
}

/** What differs, as the API takes it. Call only once `validatePrintApartForm` finds nothing. */
export function printExceptionInput(values: PrintApartValues): AdminPrintException {
  const signature = values.signedDifferently ? signatureOf(values) : null;
  return {
    ...(values.remarque && values.remarqueMedium && values.remarquePlace
      ? { remarque: { medium: values.remarqueMedium, place: values.remarquePlace } }
      : {}),
    ...(values.dedicated ? { dedicated: true as const } : {}),
    ...(signature ? { signature } : {}),
    ...(values.condition && values.conditionNote ? { condition: values.conditionNote } : {}),
  };
}

export function validatePrintApartForm(
  values: PrintApartValues,
  run: Run,
): Partial<Record<PrintApartField, string>> {
  const errors: Partial<Record<PrintApartField, string>> = {};
  if (!values.remarque && !values.dedicated && !values.signedDifferently && !values.condition) {
    errors.difference = "Say what is different about this print";
  }
  if (values.remarque) {
    if (!values.remarqueMedium) errors.remarqueMedium = "Choose what the remarque is drawn in";
    if (!values.remarquePlace) errors.remarquePlace = "Choose where the remarque is";
  }
  if (values.signedDifferently) {
    if (!values.signatureKind) {
      errors.signatureKind = "Choose how the print is signed";
    } else {
      if (signatureNeedsMedium(values.signatureKind) && !values.signatureMedium) {
        errors.signatureMedium = "Choose what it is signed in";
      }
      if (signatureNeedsPlace(values.signatureKind) && !values.signaturePlace) {
        errors.signaturePlace = "Choose where it is signed";
      }
      const signature = signatureOf(values);
      if (signature && !errors.signatureMedium && !errors.signaturePlace) {
        try {
          assertPrintException({ signature }, run.signature);
        } catch {
          errors.signatureKind = "This is how the run is signed. Choose a different signature";
        }
      }
    }
  }
  if (values.condition && !values.conditionNote) {
    errors.conditionNote = "Choose a condition note from the list";
  }
  const price = parseArtworkPrice(values.priceText);
  if (!price.ok) errors.price = price.message;
  else if (price.pence === null) errors.price = "Enter the price this print sells for";
  return errors;
}

export function printApartErrorSummary(errors: Partial<Record<PrintApartField, string>>) {
  return PRINT_APART_FIELDS.flatMap((field) => {
    const message = errors[field];
    return message ? [{ fieldId: printApartFieldId(field), message }] : [];
  });
}

/** The request body. Call only once `validatePrintApartForm` finds nothing. */
export function printApartBody(values: PrintApartValues): AdminSetPrintApartBody {
  const price = parseArtworkPrice(values.priceText);
  return {
    differences: printExceptionInput(values),
    printPricePence: price.ok && price.pence !== null ? price.pence : 1,
  };
}

/** The lines under "Shoppers will see" in the dialog, from the choices so far. */
export function printApartPreview(
  values: PrintApartValues,
  print: SetApartPrint,
): { eyebrow: string; rows: string[]; basket: string } {
  const differences = describePrintException(printExceptionInput(values));
  const text = setApartPrintOf(print);
  const label = print.of.kind === "proof" ? text : text.replace(/ of \d+$/, "");
  return {
    eyebrow: `${print.of.kind === "proof" ? "Proof" : "Limited edition print"}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
    rows: differences.rows,
    basket: [label, ...differences.basketParts].join(" · "),
  };
}
