import { describe, expect, it } from "vitest";
import {
  emptyPrintApartForm,
  printApartBody,
  printApartErrorSummary,
  printApartPreview,
  validatePrintApartForm,
} from "./print-apart-form";

const RUN = {
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
} as const;
const LIMITED = { editionNumber: 3, proofNumber: null, of: { kind: "limited", size: 30 } } as const;

const remarque = () => ({
  ...emptyPrintApartForm(),
  remarque: true,
  remarqueMedium: "pencil" as const,
  remarquePlace: "lower_margin" as const,
  priceText: "420",
});

describe("set a print apart: validation", () => {
  it("asks what is different, and for a price, when nothing is filled in", () => {
    const errors = validatePrintApartForm(emptyPrintApartForm(), RUN);
    expect(errors).toEqual({
      difference: "Say what is different about this print",
      price: "Enter the price this print sells for",
    });
  });

  it("accepts a remarque with a price", () => {
    expect(validatePrintApartForm(remarque(), RUN)).toEqual({});
  });

  it("asks for the details of each difference that is ticked", () => {
    const errors = validatePrintApartForm(
      {
        ...emptyPrintApartForm(),
        remarque: true,
        signedDifferently: true,
        condition: true,
        priceText: "420",
      },
      RUN,
    );
    expect(errors).toEqual({
      remarqueMedium: "Choose what the remarque is drawn in",
      remarquePlace: "Choose where the remarque is",
      signatureKind: "Choose how the print is signed",
      conditionNote: "Choose a condition note from the list",
    });
  });

  it("needs a medium and a place for a hand signature", () => {
    const errors = validatePrintApartForm(
      {
        ...emptyPrintApartForm(),
        signedDifferently: true,
        signatureKind: "hand_signed",
        priceText: "1",
      },
      RUN,
    );
    expect(errors.signatureMedium).toBe("Choose what it is signed in");
    expect(errors.signaturePlace).toBe("Choose where it is signed");
  });

  it("refuses the signature the run already has", () => {
    const errors = validatePrintApartForm(
      {
        ...emptyPrintApartForm(),
        signedDifferently: true,
        signatureKind: "hand_signed",
        signatureMedium: "pencil",
        signaturePlace: "front_lower_margin",
        priceText: "1",
      },
      RUN,
    );
    expect(errors.signatureKind).toBe(
      "This is how the run is signed. Choose a different signature",
    );
  });

  it("accepts a signature that differs", () => {
    const errors = validatePrintApartForm(
      {
        ...emptyPrintApartForm(),
        signedDifferently: true,
        signatureKind: "hand_signed",
        signatureMedium: "ink",
        signaturePlace: "back",
        priceText: "1",
      },
      RUN,
    );
    expect(errors).toEqual({});
  });

  it("says why a price is wrong", () => {
    expect(validatePrintApartForm({ ...remarque(), priceText: "abc" }, RUN).price).toMatch(
      /Enter the price in pounds/,
    );
    expect(validatePrintApartForm({ ...remarque(), priceText: "0" }, RUN).price).toBe(
      "The price must be more than £0.",
    );
  });

  it("lists the errors in the order of the form for the summary", () => {
    const summary = printApartErrorSummary(validatePrintApartForm(emptyPrintApartForm(), RUN));
    expect(summary.map((entry) => entry.fieldId)).toEqual([
      "print-apart-difference",
      "print-apart-price",
    ]);
  });
});

describe("set a print apart: the request and the preview", () => {
  it("sends only what is ticked, and the price in pence", () => {
    expect(
      printApartBody({
        ...remarque(),
        dedicated: true,
        condition: false,
        conditionNote: "margin_toning",
      }),
    ).toEqual({
      differences: { remarque: { medium: "pencil", place: "lower_margin" }, dedicated: true },
      printPricePence: 42000,
    });
  });

  it("previews the eyebrow, the page rows and the basket line", () => {
    expect(printApartPreview(remarque(), LIMITED)).toEqual({
      eyebrow: "Limited edition print, no. 3 of 30",
      rows: ["Remarque: an original drawing added by the artist in pencil, lower margin"],
      basket: "No. 3 · With a remarque",
    });
  });
});
