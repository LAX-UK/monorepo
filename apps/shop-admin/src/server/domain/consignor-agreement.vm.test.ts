import { describe, expect, it } from "vitest";
import {
  agreementFileProblem,
  agreementFormValues,
  agreementState,
  checkAgreementForm,
  commissionText,
  fieldErrorsFromIssues,
  lowestPriceText,
  placesSentence,
} from "./consignor-agreement.vm";

const TODAY = "2026-11-17";

describe("how an agreement reads", () => {
  it("names the places in a fixed order, as a sentence", () => {
    expect(placesSentence(["lax_art", "lax_bid"])).toBe("LAX Bid and lax.art");
    expect(placesSentence(["private_sale", "lax_bid", "lax_art"])).toBe(
      "LAX Bid, lax.art and private sale",
    );
    expect(placesSentence(["private_sale"])).toBe("Private sale");
  });

  it.each([
    [{ status: "current", startsOn: "2026-03-03", endsOn: "2027-03-02" }, "in_force"],
    [{ status: "current", startsOn: TODAY, endsOn: TODAY }, "in_force"],
    [{ status: "current", startsOn: "2026-03-03", endsOn: null }, "in_force"],
    [{ status: "current", startsOn: "2026-11-18", endsOn: null }, "not_started"],
    [{ status: "current", startsOn: "2026-01-01", endsOn: "2026-11-16" }, "expired"],
    [{ status: "retired", startsOn: "2026-01-01", endsOn: null }, "retired"],
  ] as const)("%j is %s on 17 November", (agreement, state) => {
    expect(agreementState(agreement, TODAY)).toBe(state);
  });

  it("says when no lowest price or commission was agreed", () => {
    expect(lowestPriceText(null)).toBe("None agreed");
    expect(lowestPriceText(200_000)).toBe("£2,000.00");
    expect(commissionText(null)).toBe("Not recorded");
    expect(commissionText(1250)).toBe("12.5%");
  });
});

describe("the add and replace form", () => {
  const filled = {
    ...agreementFormValues(null),
    places: ["lax_art" as const, "lax_bid" as const],
    startsOn: "2026-03-03",
    signedFileKey: "private/consignor-agreements/p/a.pdf",
  };

  it("sends the places in a fixed order, a trimmed note and empty terms as null", () => {
    expect(checkAgreementForm({ ...filled, note: "  Signed  " })).toEqual({
      ok: true,
      body: {
        places: ["lax_bid", "lax_art"],
        startsOn: "2026-03-03",
        endsOn: null,
        lowestPricePence: null,
        commissionBasisPoints: null,
        signedFileKey: "private/consignor-agreements/p/a.pdf",
        note: "Signed",
      },
    });
  });

  it.each([
    ["0.25", 2500],
    ["0.125", 1250],
    ["0", 0],
    ["1", 10_000],
  ])("turns a rate of %s into %i basis points", (rate, basisPoints) => {
    const checked = checkAgreementForm({ ...filled, commissionRate: rate });
    expect(checked.ok && checked.body.commissionBasisPoints).toBe(basisPoints);
  });

  it.each([["1.01"], ["0.333333"], [null]])("refuses a commission of %s", (rate) => {
    expect(checkAgreementForm({ ...filled, commissionRate: rate })).toMatchObject({
      ok: false,
      errors: { commissionBasisPoints: "Enter a commission from 0% to 100%, such as 25." },
    });
  });

  it("says what is missing or does not hold, beside each field", () => {
    expect(
      checkAgreementForm({
        ...agreementFormValues(null),
        startsOn: "2026-03-03",
        endsOn: "2026-03-02",
        lowestPriceTyped: true,
        note: "x".repeat(1001),
      }),
    ).toEqual({
      ok: false,
      errors: {
        places: "Choose at least one place.",
        endsOn: "The end date must be on or after the start date.",
        lowestPricePence: "Enter the lowest price in pounds, such as 2,000.",
        signedFileKey: "Upload the signed agreement.",
        note: "Keep the note to 1000 characters or fewer.",
      },
    });
    expect(checkAgreementForm({ ...filled, lowestPricePence: 0 })).toMatchObject({
      ok: false,
      errors: { lowestPricePence: "Enter a lowest price above £0, or leave it empty." },
    });
  });

  it("starts a replace from the agreement's terms and file", () => {
    const values = agreementFormValues({
      id: "v2",
      agreementId: "a",
      version: 2,
      partyId: "p",
      places: ["private_sale"],
      startsOn: "2026-03-03",
      endsOn: null,
      lowestPricePence: 150_000,
      commissionBasisPoints: 3000,
      signedFileKey: "private/consignor-agreements/p/b.pdf",
      note: null,
      status: "current",
      replacesId: "v1",
      createdAt: "2026-04-01T09:00:00.000Z",
      replacedAt: null,
      retiredAt: null,
    });
    expect(values).toMatchObject({
      places: ["private_sale"],
      lowestPricePence: 150_000,
      lowestPriceTyped: true,
      commissionRate: "0.3",
      signedFileKey: "private/consignor-agreements/p/b.pdf",
      note: "",
    });
  });

  it("keeps the first sentence the API gave for each known field", () => {
    expect(
      fieldErrorsFromIssues([
        { field: "endsOn", message: "First" },
        { field: "endsOn", message: "Second" },
        { field: "consignor", message: "Not a field here" },
        "nonsense",
      ]),
    ).toEqual({ endsOn: "First" });
  });

  it("checks a chosen file before uploading it", () => {
    expect(agreementFileProblem({ type: "application/pdf", size: 1024 })).toBeNull();
    expect(agreementFileProblem({ type: "image/gif", size: 1024 })).toBe(
      "Choose a PDF, JPEG or PNG file.",
    );
    expect(agreementFileProblem({ type: "image/png", size: 20 * 1024 * 1024 + 1 })).toBe(
      "Choose a file of 20 MB or less.",
    );
    expect(agreementFileProblem({ type: "image/png", size: 0 })).toBe(
      "This file is empty. Choose the signed agreement.",
    );
  });
});
