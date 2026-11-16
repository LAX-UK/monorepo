import { describe, expect, it } from "vitest";
import {
  INBOUND_DKIM_RESULTS,
  INBOUND_SPF_RESULTS,
  enquiryStatusAnswersClient,
  isAttachedSenderVerified,
  isHeldMailSenderUnverified,
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
    expect([...ENQUIRY_STATUSES.filter(enquiryStatusAnswersClient)].sort()).toEqual([
      "closed",
      "converted",
      "waiting_on_client",
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

describe("held mail sender verification", () => {
  const ok = { reason: "unmatched", spfResult: "pass", dkimResult: "none" } as const;

  it("is unverified for a sender reason or without an aligned pass", () => {
    expect(isHeldMailSenderUnverified(ok)).toBe(false);
    expect(isHeldMailSenderUnverified({ ...ok, reason: "auto_reply" })).toBe(false);
    for (const reason of ["bad_token", "sender_mismatch", "spf_failed", "unauthenticated"] as const)
      expect(isHeldMailSenderUnverified({ ...ok, reason })).toBe(true);
    expect(isHeldMailSenderUnverified({ ...ok, spfResult: "pass_unaligned" })).toBe(true);
    expect(isHeldMailSenderUnverified({ ...ok, spfResult: null, dkimResult: null })).toBe(true);
    expect(isHeldMailSenderUnverified({ ...ok, spfResult: "fail", dkimResult: "pass" })).toBe(
      false,
    );
  });

  it("verifies an attached sender only from the enquirer's address", () => {
    expect(isAttachedSenderVerified(ok, true)).toBe(true);
    expect(isAttachedSenderVerified(ok, false)).toBe(false);
    expect(isAttachedSenderVerified({ ...ok, reason: "sender_mismatch" }, true)).toBe(false);
  });

  it("keeps an unaligned SPF pass as its own result", () => {
    expect(INBOUND_SPF_RESULTS).toContain("pass_unaligned");
    expect(isInboundSenderAuthenticated({ spf: "pass_unaligned", dkim: "none" })).toBe(false);
  });
});
