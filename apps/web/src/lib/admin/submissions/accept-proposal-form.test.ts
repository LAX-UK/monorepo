import { acceptSubmissionBodySchema } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  EMPTY_ACCEPT_PROPOSAL,
  EMPTY_TERMS,
  acceptProposalBody,
  acceptProposalFormSchema,
  proposeTermsBody,
  termsFormSchema,
} from "./accept-proposal-form";

describe("terms form", () => {
  it("needs the estimate and the commission", () => {
    const result = termsFormSchema.safeParse(EMPTY_TERMS);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toEqual([
      "estimateLow",
      "estimateHigh",
      "commissionRate",
    ]);
  });

  it("sends complete terms", () => {
    expect(
      proposeTermsBody({
        estimateLow: "8000.00",
        estimateHigh: "12000.00",
        reservePrice: "",
        commissionRate: "0.15",
      }),
    ).toEqual({ estimateLow: "8000.00", estimateHigh: "12000.00", commissionPercent: "15" });
  });
});

describe("accept proposal form", () => {
  it("sends the estimate, reserve and commission the specialist proposes", () => {
    const body = acceptProposalBody({
      reviewNotes: "  Strong example  ",
      estimateLow: "8000.00",
      estimateHigh: "12000.00",
      reservePrice: "7000.00",
      commissionRate: "0.125",
    });
    expect(body).toEqual({
      reviewNotes: "Strong example",
      estimateLow: "8000.00",
      estimateHigh: "12000.00",
      reservePrice: "7000.00",
      commissionPercent: "12.5",
    });
    expect(acceptSubmissionBodySchema.safeParse(body).success).toBe(true);
  });

  it("leaves out what was not given", () => {
    expect(acceptProposalBody(EMPTY_ACCEPT_PROPOSAL)).toEqual({});
  });

  it("asks for both ends of the estimate", () => {
    const result = acceptProposalFormSchema.safeParse({
      ...EMPTY_ACCEPT_PROPOSAL,
      estimateLow: "8000.00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["estimateHigh"]);
  });

  it("refuses a high estimate below the low one", () => {
    const result = acceptProposalFormSchema.safeParse({
      ...EMPTY_ACCEPT_PROPOSAL,
      estimateLow: "12000.00",
      estimateHigh: "8000.00",
    });
    expect(result.error?.issues[0]?.message).toBe(
      "The high estimate must be at least the low estimate",
    );
  });

  it("refuses a commission that is not a rate", () => {
    const result = acceptProposalFormSchema.safeParse({
      ...EMPTY_ACCEPT_PROPOSAL,
      commissionRate: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});
