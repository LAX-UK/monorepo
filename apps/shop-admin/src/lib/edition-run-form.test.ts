import { describe, expect, it } from "vitest";
import {
  allocationTotalText,
  allocationTotals,
  batchSummaryText,
  emptyRunForm,
  firstBatchInput,
  formNumberingText,
  previewSpec,
  proofsKeptInput,
  runFormValues,
  runSpecInput,
  validateRunForm,
  withTemplate,
} from "./edition-run-form";

const unlinked = { linkedToOriginal: false };

function custom(size: string, buyer: string, artist: string, lax: string) {
  return {
    ...withTemplate(emptyRunForm(), "custom_limited"),
    sizeText: size,
    allocation: { buyer, artist, lax },
  };
}

describe("run form", () => {
  it("starts as LAX standard with its numbering, and is valid as it is", () => {
    const values = emptyRunForm();
    expect(values.template).toBe("lax_standard");
    expect(validateRunForm(values, unlinked)).toEqual({});
    expect(formNumberingText(values)).toBe("Numbering: 1–10 buyers · 11–20 artist · 21–24 LAX");
    expect(runSpecInput(values)).toEqual({ type: "lax_standard" });
  });

  it("switching to custom starts from the standard split scaled to the size", () => {
    const values = withTemplate({ ...emptyRunForm(), sizeText: "40" }, "custom_limited");
    expect(values.allocation).toEqual({ buyer: "17", artist: "17", lax: "6" });
  });

  it("shows a live total that says what is left or over", () => {
    expect(allocationTotalText(allocationTotals(custom("24", "10", "10", "4")))).toEqual({
      text: "24 of 24 allocated",
      complete: true,
    });
    expect(allocationTotalText(allocationTotals(custom("24", "6", "12", "4")))).toEqual({
      text: "22 of 24 allocated: 2 left",
      complete: false,
    });
    expect(allocationTotalText(allocationTotals(custom("24", "6", "16", "4"))).text).toBe(
      "26 of 24 allocated: 2 too many",
    );
  });

  it("numbers buyers first, then the artist, then LAX, leaving out empty groups", () => {
    expect(formNumberingText(custom("40", "0", "30", "10"))).toBe(
      "Numbering: 1–30 artist · 31–40 LAX",
    );
    expect(formNumberingText(custom("40", "0", "30", "9"))).toBeNull();
  });

  it.each([
    [custom("1", "0", "1", "0"), "size", "The size must be between 2 and 500"],
    [custom("501", "0", "501", "0"), "size", "The size must be between 2 and 500"],
    [custom("24", "6", "12", "4"), "allocation", "Allocate every print: 2 are not allocated"],
    [
      custom("4", "4", "0", "0"),
      "allocation",
      "At least one print must belong to the artist or LAX",
    ],
    [custom("24", "a", "20", "4"), "allocation", "Enter whole numbers of prints, 0 or more"],
  ] as const)("refuses %#: %s", (values, field, message) => {
    expect(validateRunForm(values, { linkedToOriginal: true })[field]).toBe(message);
  });

  it("asks for a linked original when there are buyer prints", () => {
    const values = custom("24", "6", "14", "4");
    expect(validateRunForm(values, unlinked).original).toBe(
      "Buyer prints need an original on lax.art. Link the original or set buyers to 0",
    );
    expect(validateRunForm(values, { linkedToOriginal: true })).toEqual({});
    expect(previewSpec(values, { linkedToOriginal: true })).toMatchObject({
      type: "custom_limited",
      size: 24,
      linkedToOriginal: true,
    });
    expect(previewSpec(values, unlinked)).toBeNull();
  });

  it("splits an open edition's first batch by the default, and asks where printed stock is", () => {
    const values = {
      ...withTemplate(emptyRunForm(), "open"),
      openArtistPctText: "50",
      firstBatchText: "20",
    };
    expect(firstBatchInput(values)).toEqual({
      artistCount: 10,
      laxCount: 10,
      custody: "unprinted",
    });
    expect(batchSummaryText({ quantity: 20, artist: 10, lax: 10, firstStockRef: 1 })).toBe(
      "20 prints: 10 artist, 10 LAX. Stock references OE-0001 to OE-0020.",
    );
    expect(validateRunForm({ ...values, firstBatchCustody: "stored" }, unlinked)).toEqual({
      firstBatchLocation: "Say where the printed stock is stored",
    });
    expect(validateRunForm({ ...values, openArtistPctText: "120" }, unlinked).openSplit).toBe(
      "Enter the artist's share as a whole percent, 0 to 100",
    );
    expect(firstBatchInput({ ...values, firstBatchText: "" })).toBeNull();
  });

  it("reads blank proofs kept as none, and a stored run back into the form", () => {
    expect(
      proofsKeptInput({ ...emptyRunForm(), proofsKept: { ap: "3", pp: "", hc: "", bat: "1" } }),
    ).toEqual({ ap: 3, pp: 0, hc: 0, bat: 1 });
    const stored = runFormValues(
      {
        type: "custom_limited",
        size: 40,
        allocation: { buyer: 0, artist: 30, lax: 10 },
        linkedToOriginal: false,
      },
      { ap: 3, pp: 0, hc: 0, bat: 0 },
    );
    expect(stored).toMatchObject({
      template: "custom_limited",
      sizeText: "40",
      allocation: { buyer: "0", artist: "30", lax: "10" },
      proofsKept: { ap: "3", pp: "" },
    });
  });
});
