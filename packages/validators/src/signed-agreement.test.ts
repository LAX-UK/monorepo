import { describe, expect, it } from "vitest";
import {
  SIGNED_AGREEMENT_MESSAGES,
  checkSignedAgreement,
  recordSignedAgreementBodySchema,
  signedAgreementCommission,
} from "./signed-agreement.js";

const TODAY = "2026-11-13";
const valid = {
  commissionPercent: "12",
  signedOn: "2026-10-03",
  uploadObjectId: "6f1c2b0e-3a43-4d1b-9a7e-2f7d3c0d9b11",
  reason: "Paper agreement signed at the gallery",
};

describe("checkSignedAgreement", () => {
  it("accepts a complete agreement", () => {
    expect(checkSignedAgreement(valid, TODAY)).toEqual({});
  });

  it("names every missing field with what to do", () => {
    expect(
      checkSignedAgreement(
        { commissionPercent: "", signedOn: "", uploadObjectId: null, reason: "short" },
        TODAY,
      ),
    ).toEqual(SIGNED_AGREEMENT_MESSAGES);
  });

  it.each(["0", "12.5", "12.25%", "50"])("accepts a commission of %s", (commissionPercent) => {
    expect(checkSignedAgreement({ ...valid, commissionPercent }, TODAY)).toEqual({});
  });

  it.each(["50.01", "-1", "abc", "12.555", "100"])("refuses a commission of %s", (value) => {
    expect(checkSignedAgreement({ ...valid, commissionPercent: value }, TODAY)).toEqual({
      commissionPercent: SIGNED_AGREEMENT_MESSAGES.commissionPercent,
    });
  });

  it.each(["2026-11-14", "2026-02-30", "03/10/2026", "1999-12-31", "0201-10-03", "3026-10-03"])(
    "refuses a signing date of %s",
    (signedOn) => {
      expect(checkSignedAgreement({ ...valid, signedOn }, TODAY)).toEqual({
        signedOn: SIGNED_AGREEMENT_MESSAGES.signedOn,
      });
    },
  );

  it.each(["2000-01-01", TODAY])("accepts a signing date of %s", (signedOn) => {
    expect(checkSignedAgreement({ ...valid, signedOn }, TODAY)).toEqual({});
  });

  it("counts the reason without its surrounding spaces", () => {
    expect(checkSignedAgreement({ ...valid, reason: "   too short   " }, TODAY)).toEqual({
      reason: SIGNED_AGREEMENT_MESSAGES.reason,
    });
  });
});

describe("signedAgreementCommission", () => {
  it("stores two decimals", () => {
    expect(signedAgreementCommission("12.5%")).toBe("12.50");
    expect(signedAgreementCommission("12")).toBe("12.00");
  });
});

describe("recordSignedAgreementBodySchema", () => {
  it("defaults to recording, not replacing", () => {
    expect(recordSignedAgreementBodySchema.parse(valid).replace).toBe(false);
  });
});
