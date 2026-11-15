import { describe, expect, it } from "vitest";
import {
  INBOUND_DKIM_RESULTS,
  INBOUND_SPF_RESULTS,
  enquiryStatusAnswersClient,
  isInboundSenderAuthenticated,
  quarantineReviewRefusal,
} from "./marketing-enquiry-inbound.js";
import { ENQUIRY_STATUSES } from "./marketing-enquiry-vocabulary.js";

describe("isInboundSenderAuthenticated", () => {
  it("accepts SPF pass or an aligned DKIM pass, and nothing else", () => {
    const accepted: string[] = [];
    for (const spf of INBOUND_SPF_RESULTS) {
      for (const dkim of INBOUND_DKIM_RESULTS) {
        if (isInboundSenderAuthenticated({ spf, dkim })) accepted.push(`${spf}/${dkim}`);
      }
    }
    expect(accepted.every((pair) => pair.startsWith("pass/") || pair.endsWith("/pass"))).toBe(true);
    expect(accepted).toHaveLength(INBOUND_DKIM_RESULTS.length + INBOUND_SPF_RESULTS.length - 1);
  });

  it("does not accept a DKIM signature for another domain", () => {
    expect(isInboundSenderAuthenticated({ spf: "none", dkim: "pass_unaligned" })).toBe(false);
    expect(isInboundSenderAuthenticated({ spf: "softfail", dkim: "pass_unaligned" })).toBe(false);
  });
});

describe("enquiryStatusAnswersClient", () => {
  it("is true for waiting on client, closed and converted only", () => {
    expect(ENQUIRY_STATUSES.filter(enquiryStatusAnswersClient)).toEqual([
      "waiting_on_client",
      "closed",
      "converted",
    ]);
  });
});

describe("quarantineReviewRefusal", () => {
  it("lets a pending message be reviewed once", () => {
    expect(quarantineReviewRefusal("pending")).toBeNull();
    expect(quarantineReviewRefusal("linked")).toBe("already_reviewed");
    expect(quarantineReviewRefusal("dismissed")).toBe("already_reviewed");
  });
});
