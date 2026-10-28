import type { AdminEditionRunSpec } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  type FactsFormValues,
  emptyFactsForm,
  factsFormValues,
  factsInput,
  factsPreview,
  validateFactsForm,
  withRun,
} from "./edition-facts-form";

const STANDARD: AdminEditionRunSpec = { type: "lax_standard" };
const OPEN: AdminEditionRunSpec = { type: "open", defaultSplit: { artistPct: 50, laxPct: 50 } };

const handSigned: FactsFormValues = {
  ...emptyFactsForm(),
  signature: "hand_signed",
  medium: "pencil",
  place: "front_lower_margin",
  numbering: "on_print",
  certificate: "included",
  issuer: "artist",
  form: "paper",
  arrives: "with_print",
};

describe("edition facts form", () => {
  it("starts with nothing chosen, so every group must be answered", () => {
    expect(validateFactsForm(emptyFactsForm(), STANDARD)).toEqual({
      signature: "Choose how the prints are signed",
      numbering: "Choose how the prints are numbered",
      certificate: "Choose whether a certificate comes with the prints",
    });
    expect(factsInput(emptyFactsForm())).toBeNull();
  });

  it("asks for what a hand signature is written in and where it is", () => {
    const errors = validateFactsForm({ ...handSigned, medium: null, place: null }, STANDARD);
    expect(errors.medium).toBe("Say what the signature is written in");
    expect(errors.place).toBe("Say where the signature is");
  });

  it("needs a certificate that carries the number for numbering on the certificate", () => {
    expect(
      validateFactsForm(
        { ...handSigned, numbering: "on_certificate", certificate: "none" },
        STANDARD,
      ).numbering,
    ).toBe("A number on the certificate needs a certificate that carries the number");
    expect(
      validateFactsForm({ ...handSigned, numberedToMatch: false }, STANDARD).numberedToMatchReason,
    ).toBe("Say why the certificate is not numbered to match");
  });

  it("fixes an open edition's numbering to not numbered", () => {
    expect(withRun({ ...handSigned, numbering: "on_print" }, OPEN).numbering).toBe("none");
    expect(validateFactsForm({ ...handSigned, numbering: "on_print" }, OPEN).numbering).toBe(
      "Open editions are not numbered",
    );
  });

  it("asks how long a certificate sent separately takes, but not for a digital one", () => {
    expect(
      validateFactsForm({ ...handSigned, arrives: "separately", withinWeeksText: "" }, STANDARD)
        .withinWeeks,
    ).toBe("Enter the weeks it takes, 1 to 52");
    expect(validateFactsForm({ ...handSigned, form: "digital", arrives: null }, STANDARD)).toEqual(
      {},
    );
  });

  it("reads stored facts back into the form", () => {
    const input = factsInput(handSigned);
    expect(input).not.toBeNull();
    expect(factsFormValues(input, true)).toMatchObject({ ...handSigned, confirmed: true });
  });
});

describe("Shoppers will see", () => {
  it("shows the edition row alone until every fact is chosen", () => {
    expect(factsPreview(emptyFactsForm(), STANDARD)).toEqual({
      state: "partial",
      edition: "Limited edition of 24",
      message: "Choose the signature, numbering and certificate to see the full wording.",
    });
  });

  it("writes the edition page, card and an order line from the shop's describer", () => {
    const preview = factsPreview(handSigned, STANDARD, { ap: 3, pp: 0, hc: 0, bat: 0 });
    expect(preview.state).toBe("complete");
    if (preview.state !== "complete") return;
    expect(preview.description.rows).toEqual({
      edition: "Limited edition of 24",
      signature: "Signed by hand in pencil by the artist, front lower margin",
      number:
        "Numbered by hand on the print. Your number appears in your order once payment is confirmed.",
      certificate: "Certificate of authenticity from the artist, sent with your print",
      proofs: "The artist also kept 3 artist's proofs, outside the edition of 24.",
    });
    expect(preview.description.cardLine).toBe("Limited edition of 24 · Hand-signed");
    expect(preview.orderLine).toBe("No. 7 of 24 · Hand-signed · Certificate from the artist");
  });

  it("describes an open edition without a number", () => {
    const preview = factsPreview(
      { ...emptyFactsForm(), signature: "unsigned", numbering: "none", certificate: "none" },
      OPEN,
    );
    expect(preview.state === "complete" && preview.description.cardLine).toBe(
      "Open edition · Unsigned",
    );
    expect(preview.state === "complete" && preview.orderLine).toBe("Open edition · Unsigned");
  });
});
