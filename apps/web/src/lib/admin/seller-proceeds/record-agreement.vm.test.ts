import { describe, expect, it } from "vitest";
import {
  checkRecordAgreement,
  previewRecordedAgreement,
  recordedToast,
} from "./record-agreement.vm";

const TODAY = "2026-11-13";

describe("checkRecordAgreement", () => {
  it("lists every missing field in the form's order, with the summary count", () => {
    const check = checkRecordAgreement(
      { commissionPercent: "", signedOn: "", uploadObjectId: null, reason: "" },
      TODAY,
    );
    expect(check.summary).toBe("Check 4 fields");
    expect(check.list.map((item) => item.message)).toEqual([
      "Enter the commission from the signed agreement, from 0% to 50%.",
      "Enter the date it was signed.",
      "Add the signed agreement as a PDF.",
      "Say why it's recorded here, in at least 10 characters.",
    ]);
  });

  it("counts two fields as two", () => {
    const check = checkRecordAgreement(
      {
        commissionPercent: "60",
        signedOn: "2026-10-03",
        uploadObjectId: null,
        reason: "Signed on paper",
      },
      TODAY,
    );
    expect(check.summary).toBe("Check 2 fields");
    expect(Object.keys(check.errors)).toEqual(["commissionPercent", "document"]);
  });

  it("has no summary when the agreement is complete", () => {
    expect(
      checkRecordAgreement(
        {
          commissionPercent: "12",
          signedOn: "2026-10-03",
          uploadObjectId: "u",
          reason: "Signed on paper",
        },
        TODAY,
      ).summary,
    ).toBeNull();
  });
});

describe("previewRecordedAgreement", () => {
  it("prices the held sale with the calculator as the commission is typed", () => {
    expect(previewRecordedAgreement("12", 620_000, "standard")).toEqual({
      kind: "priced",
      commissionBps: 1200,
      commissionPence: 74_400,
      vat: { kind: "charged", rateBps: 2000, pence: 14_880 },
      netPence: 530_720,
    });
  });

  it("shows no VAT when the company is not registered", () => {
    expect(previewRecordedAgreement("12", 620_000, "not_registered")).toMatchObject({
      vat: { kind: "not_registered", companyName: "London Auction Xchange LTD" },
      netPence: 545_600,
    });
  });

  it.each(["", "abc", "60"])("shows nothing for %j", (text) => {
    expect(previewRecordedAgreement(text, 620_000, "standard")).toEqual({ kind: "none" });
  });

  it("shows nothing while the VAT setting is missing", () => {
    expect(previewRecordedAgreement("12", 620_000, null)).toEqual({ kind: "none" });
  });
});

describe("recordedToast", () => {
  it("says the lot joins the next payout", () => {
    expect(recordedToast("Lot 21")).toBe("Agreement recorded. Lot 21 joins the next payout.");
  });
});
