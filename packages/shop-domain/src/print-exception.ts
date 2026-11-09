import type { EditionListingStatus } from "./edition-listing-state.js";
import { type EditionRunSpec, isOpenRun, proofLabel, runSize } from "./edition-run.js";
import { ShopDomainError } from "./shop-domain-error.js";
import { SIGNATURE_MEDIA, SIGNATURE_PLACES, type Signature } from "./signature.js";

/**
 * A print that differs from the rest of its run, so it is sold on its own: an original drawing
 * added by the artist, a dedication, a signature that differs from the run's, or a mark of
 * condition. What shoppers read about it is written here from a fixed set of choices, never from
 * free text. Everything here is pure.
 */

export const REMARQUE_MEDIA = ["pencil", "ink", "coloured_pencil"] as const;
export type RemarqueMedium = (typeof REMARQUE_MEDIA)[number];

export const REMARQUE_PLACES = ["lower_margin", "upper_margin", "side_margin"] as const;
export type RemarquePlace = (typeof REMARQUE_PLACES)[number];

export const CONDITION_NOTES = [
  "light_handling_marks",
  "margin_toning",
  "small_crease_in_margin",
] as const;
export type ConditionNote = (typeof CONDITION_NOTES)[number];

export type PrintException = {
  /** An original drawing the artist added to the print. */
  remarque?: { medium: RemarqueMedium; place: RemarquePlace };
  /** Inscribed to a named person; the name stays with staff. */
  dedicated?: true;
  /** Signed in a way that differs from the run's signature. */
  signature?: Signature;
  condition?: ConditionNote;
};

export type ExceptionKind = "remarque" | "dedication" | "signature" | "condition";

export const EXCEPTION_KINDS: readonly ExceptionKind[] = [
  "remarque",
  "dedication",
  "signature",
  "condition",
];

export function exceptionKinds(exception: PrintException): ExceptionKind[] {
  return EXCEPTION_KINDS.filter((kind) => {
    switch (kind) {
      case "remarque":
        return exception.remarque !== undefined;
      case "dedication":
        return exception.dedicated === true;
      case "signature":
        return exception.signature !== undefined;
      case "condition":
        return exception.condition !== undefined;
    }
  });
}

const MEDIUM_PHRASES: Record<RemarqueMedium, string> = {
  pencil: "pencil",
  ink: "ink",
  coloured_pencil: "coloured pencil",
};

const PLACE_PHRASES: Record<RemarquePlace, string> = {
  lower_margin: "lower margin",
  upper_margin: "upper margin",
  side_margin: "side margin",
};

const CONDITION_PHRASES: Record<ConditionNote, string> = {
  light_handling_marks: "light handling marks in the margin",
  margin_toning: "toning in the margin",
  small_crease_in_margin: "a small crease in the margin",
};

export const MEDIUM_LABELS: Record<RemarqueMedium, string> = {
  pencil: "Pencil",
  ink: "Ink",
  coloured_pencil: "Coloured pencil",
};

export const PLACE_LABELS: Record<RemarquePlace, string> = {
  lower_margin: "Lower margin",
  upper_margin: "Upper margin",
  side_margin: "Side margin",
};

export const CONDITION_LABELS: Record<ConditionNote, string> = {
  light_handling_marks: "Light handling marks",
  margin_toning: "Margin toning",
  small_crease_in_margin: "Small crease in the margin",
};

function sameSignature(a: Signature, b: Signature): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "hand_signed" && b.kind === "hand_signed") {
    return a.medium === b.medium && a.place === b.place;
  }
  if (a.kind === "estate_signed" && b.kind === "estate_signed") return a.place === b.place;
  return true;
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function assertSignatureShape(signature: Signature): void {
  if (signature.kind === "hand_signed") {
    if (
      !isOneOf(SIGNATURE_MEDIA, signature.medium) ||
      !isOneOf(SIGNATURE_PLACES, signature.place)
    ) {
      throw new ShopDomainError("Choose how and where the print is signed");
    }
  }
  if (signature.kind === "estate_signed" && !isOneOf(SIGNATURE_PLACES, signature.place)) {
    throw new ShopDomainError("Choose where the estate signed the print");
  }
}

/**
 * Checks what differs about a print. At least one difference is needed, each must be one of the
 * fixed choices, and a signature counts as different only when it differs from the run's.
 */
export function assertPrintException(exception: PrintException, runSignature: Signature): void {
  if (exceptionKinds(exception).length === 0) {
    throw new ShopDomainError("Say what is different about this print");
  }
  if (exception.remarque) {
    const { medium, place } = exception.remarque;
    if (!isOneOf(REMARQUE_MEDIA, medium))
      throw new ShopDomainError("Choose what the remarque is drawn in");
    if (!isOneOf(REMARQUE_PLACES, place)) throw new ShopDomainError("Choose where the remarque is");
  }
  if (exception.signature) {
    assertSignatureShape(exception.signature);
    if (sameSignature(exception.signature, runSignature)) {
      throw new ShopDomainError("This is how the run is signed. Choose a different signature");
    }
  }
  if (exception.condition !== undefined && !isOneOf(CONDITION_NOTES, exception.condition)) {
    throw new ShopDomainError("Choose a condition note from the list");
  }
}

/** Who may set a print apart: only prints of a numbered run or a proof have an identity. */
export function assertRunHasNumberedPrints(run: EditionRunSpec): void {
  if (run.type === "set_apart") {
    throw new ShopDomainError("This print is already sold on its own");
  }
  if (isOpenRun(run)) {
    throw new ShopDomainError("An open edition print has no number, so it cannot be set apart");
  }
}

/** Why a print cannot be set apart now. */
export type SetApartBlock =
  | { kind: "sold" }
  | { kind: "in_basket"; until: Date | null }
  | { kind: "held" }
  | { kind: "withdrawn" }
  | { kind: "not_for_sale" }
  | { kind: "already_apart" };

export type PrintState = {
  listingStatus: EditionListingStatus;
  /** When a basket's reservation ends; null when none is recorded. */
  reservedUntil: Date | null;
  /** Whether an order that has not been paid still holds the print. */
  reservedByPendingOrder: boolean;
  /** Whether a seller owns the print and it is in a place it can be sold from. */
  forSale: boolean;
  alreadySetApart: boolean;
};

/** The reason a print cannot be set apart, or null when it can. */
export function setApartBlock(print: PrintState, now: Date): SetApartBlock | null {
  if (print.alreadySetApart) return { kind: "already_apart" };
  switch (print.listingStatus) {
    case "sold":
      return { kind: "sold" };
    case "held":
      return { kind: "held" };
    case "withdrawn":
      return { kind: "withdrawn" };
    case "reserved": {
      const live =
        print.reservedByPendingOrder ||
        print.reservedUntil === null ||
        print.reservedUntil.getTime() >= now.getTime();
      if (live) return { kind: "in_basket", until: print.reservedUntil };
      break;
    }
    case "not_authorised":
    case "authorised":
      break;
  }
  return print.forSale ? null : { kind: "not_for_sale" };
}

/** The sentence staff read when a print cannot be set apart: a title and what to do. */
export function describeSetApartBlock(
  block: SetApartBlock,
  label: string,
  formatUntil: (until: Date) => string,
): { title: string; detail: string } {
  switch (block.kind) {
    case "sold":
      return {
        title: `Print ${label} is sold`,
        detail: "A sold print cannot be set apart. Choose another print.",
      };
    case "in_basket":
      return {
        title: `Print ${label} is in a buyer's basket`,
        detail: block.until
          ? `It is reserved until ${formatUntil(block.until)}. Set it apart after the reservation ends, or choose another print.`
          : "Set it apart after the reservation ends, or choose another print.",
      };
    case "held":
      return {
        title: `Print ${label} is held for a buyer`,
        detail: "Set it apart once the hold is released, or choose another print.",
      };
    case "withdrawn":
      return {
        title: `Print ${label} is withdrawn`,
        detail: "Put it back on sale first, or choose another print.",
      };
    case "not_for_sale":
      return {
        title: `Print ${label} is not for sale`,
        detail: "Only a print that LAX or the artist owns and can sell can be set apart.",
      };
    case "already_apart":
      return {
        title: `Print ${label} is already sold on its own`,
        detail: "Return it to the run before setting it apart again.",
      };
  }
}

/** The sentence staff read when a print cannot go back to its run: a title and what to do. */
export function describeReturnBlock(
  block: SetApartBlock,
  label: string,
  formatUntil: (until: Date) => string,
): { title: string; detail: string } {
  const { title } = describeSetApartBlock(block, label, formatUntil);
  switch (block.kind) {
    case "sold":
      return {
        title,
        detail: "A sold print stays with its listing, so the order keeps describing it.",
      };
    case "in_basket":
      return {
        title,
        detail: block.until
          ? `It is reserved until ${formatUntil(block.until)}. Return it after the reservation ends.`
          : "Return it after the reservation ends.",
      };
    case "held":
      return { title, detail: "Return it once the hold is released." };
    case "withdrawn":
      return { title, detail: "Put it back on sale first, then return it." };
    case "not_for_sale":
    case "already_apart":
      return { title, detail: "It cannot go back to the run now." };
  }
}

/** A print can go back to its run only while it is unsold and not in a basket. */
export function returnBlock(print: Omit<PrintState, "alreadySetApart" | "forSale">, now: Date) {
  return setApartBlock({ ...print, forSale: true, alreadySetApart: false }, now);
}

const SIGNATURE_SENTENCES: Record<Signature["kind"], string> = {
  hand_signed: "signed by hand",
  plate_signed: "with the signature printed in the plate",
  estate_stamped: "stamped by the artist's estate",
  estate_signed: "signed by the artist's estate",
  unsigned: "unsigned",
};

export type ExceptionDescription = {
  /** Rows for the page: "Remarque: an original drawing added by the artist in pencil, lower margin". */
  rows: string[];
  /** The same rows as a label and a value, for a facts list: "Remarque", "An original drawing…". */
  items: { label: string; value: string }[];
  /** Short phrases for the basket: "With a remarque". */
  basketParts: string[];
  /** The detail on an invoice, after the print's number: "with a remarque in pencil, lower margin". */
  invoiceParts: string[];
};

/** The sentences a shopper reads about what differs. Fixed wording; the dedicatee is never named. */
export function describePrintException(exception: PrintException): ExceptionDescription {
  const rows: string[] = [];
  const items: { label: string; value: string }[] = [];
  const basketParts: string[] = [];
  const invoiceParts: string[] = [];
  if (exception.remarque) {
    const where = `${MEDIUM_PHRASES[exception.remarque.medium]}, ${PLACE_PHRASES[exception.remarque.place]}`;
    rows.push(`Remarque: an original drawing added by the artist in ${where}`);
    items.push({
      label: "Remarque",
      value: `An original drawing added by the artist in ${where}`,
    });
    basketParts.push("With a remarque");
    invoiceParts.push(`with a remarque in ${where}`);
  }
  if (exception.dedicated) {
    rows.push("Dedicated to a named person");
    items.push({ label: "Dedication", value: "Dedicated to a named person" });
    basketParts.push("With a dedication");
    invoiceParts.push("with a dedication");
  }
  if (exception.signature) {
    rows.push("Signed differently from the rest of the edition");
    items.push({ label: "Signed", value: "Differently from the rest of the edition" });
    basketParts.push("Signed differently");
    invoiceParts.push(
      `signed differently from the edition (${SIGNATURE_SENTENCES[exception.signature.kind]})`,
    );
  }
  if (exception.condition) {
    rows.push(`Condition: ${CONDITION_PHRASES[exception.condition]}`);
    items.push({
      label: "Condition",
      value: CONDITION_PHRASES[exception.condition].replace(/^./, (letter) => letter.toUpperCase()),
    });
    basketParts.push("With a condition note");
    invoiceParts.push(`condition: ${CONDITION_PHRASES[exception.condition]}`);
  }
  return { rows, items, basketParts, invoiceParts };
}

/** The listing's title: "Tide line (no. 3, with a remarque)". */
export function setApartListingTitle(
  mainTitle: string,
  printText: string,
  exception: PrintException,
): string {
  return `${mainTitle.trim()} (${lowerParts(printText, exception)})`;
}

/** "tide-line-no-3". */
export function setApartListingSlug(mainSlug: string, printText: string): string {
  const suffix = printText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${mainSlug}-${suffix}`;
}

/** "No. 3, with a remarque": the number, then what differs, as a phrase inside a sentence. */
function lowerParts(printText: string, exception: PrintException): string {
  const parts = describePrintException(exception).basketParts.map(lowerFirst);
  return [printText, ...parts].join(", ");
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "No. 3, with a remarque": how a main page names a print set apart beside "Also available". */
export function describeSetApartAvailable(printText: string, exception: PrintException): string {
  return lowerParts(printText, exception);
}

/** The identity a set-apart print is sold by. */
export type SetApartPrint = {
  editionNumber: number | null;
  proofNumber: number | null;
  /** The run it came from: a limited run of this size, or a proof listing. */
  of: { kind: "limited"; size: number } | { kind: "proof"; label: string; size: number };
};

/** The identity of a print of `run` that is sold on its own; null when the run has no numbered prints. */
export function setApartPrintFor(
  run: EditionRunSpec,
  print: { editionNumber?: number | null | undefined; proofNumber?: number | null | undefined },
): SetApartPrint | null {
  if (run.type === "proof") {
    return {
      editionNumber: null,
      proofNumber: print.proofNumber ?? null,
      of: { kind: "proof", label: proofLabel(run.proofType), size: run.size },
    };
  }
  const size = runSize(run);
  if (size === null || run.type === "set_apart") return null;
  return {
    editionNumber: print.editionNumber ?? null,
    proofNumber: null,
    of: { kind: "limited", size },
  };
}

/** "No. 3" for a numbered print, "AP 1" for a proof. */
export function setApartPrintText(print: SetApartPrint): string {
  if (print.of.kind === "proof") return `${print.of.label} ${print.proofNumber ?? ""}`.trim();
  return `No. ${print.editionNumber ?? ""}`.trim();
}

/** "No. 3 of 30" or "AP 1/3". */
export function setApartPrintOf(print: SetApartPrint): string {
  if (print.of.kind === "proof") {
    return `${print.of.label} ${print.proofNumber ?? ""}/${print.of.size}`;
  }
  return `No. ${print.editionNumber ?? ""} of ${print.of.size}`;
}
