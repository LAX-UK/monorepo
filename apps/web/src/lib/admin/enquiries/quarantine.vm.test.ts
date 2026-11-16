import { describe, expect, it } from "vitest";
import {
  QUARANTINE_PATH,
  attachTarget,
  normaliseEnquiryReference,
  quarantineErrorMessage,
  quarantineHref,
  quarantineListHref,
  quarantineViewOf,
  reviewReasonError,
  reviewReasonOf,
  senderCheckItems,
  senderUnverified,
  subjectLine,
} from "./quarantine.vm";

describe("quarantine addresses", () => {
  it("keeps the default view out of the query", () => {
    expect(QUARANTINE_PATH).toBe("/admin/enquiries/quarantine");
    expect(quarantineListHref("pending")).toBe("/admin/enquiries/quarantine");
    expect(quarantineListHref("reviewed", "abc")).toBe(
      "/admin/enquiries/quarantine?view=reviewed&cursor=abc",
    );
    expect(quarantineHref("id-1")).toBe("/admin/enquiries/quarantine/id-1");
    expect(quarantineViewOf("reviewed")).toBe("reviewed");
    expect(quarantineViewOf(["reviewed"])).toBe("pending");
    expect(quarantineViewOf(undefined)).toBe("pending");
  });
});

describe("attach target", () => {
  it("is the suspected enquiry, or a typed reference made canonical", () => {
    expect(attachTarget("suspect", "E-1042", "")).toBe("E-1042");
    expect(attachTarget("other", "E-1042", " e-2001 ")).toBe("E-2001");
    expect(attachTarget("other", null, "2001")).toBeNull();
    expect(normaliseEnquiryReference("E-12")).toBeNull();
  });
});

describe("words", () => {
  it("says what the sender checks recorded, or that nothing was", () => {
    expect(
      senderCheckItems({ spfResult: "pass", dkimResult: "pass_unaligned" } as never).map(
        (item) => item.value,
      ),
    ).toEqual(["Passed", "Passed for another domain"]);
    expect(
      senderCheckItems({ spfResult: null, dkimResult: null } as never).map((item) => item.value),
    ).toEqual(["Not recorded", "Not recorded"]);
  });

  it("never shows an empty subject", () => {
    expect(subjectLine("  ")).toBe("(no subject)");
    expect(subjectLine("Re: E-1042")).toBe("Re: E-1042");
  });

  it("maps refusals to sentences", () => {
    expect(quarantineErrorMessage("already_reviewed", 409)).toMatch(
      /already attached or discarded/,
    );
    expect(quarantineErrorMessage(undefined, 403)).toMatch(/permission/);
    expect(quarantineErrorMessage(undefined, undefined)).toMatch(/didn't answer/);
    expect(quarantineErrorMessage("enquiry_erased", 422)).toMatch(/erased at the client's request/);
    expect(quarantineErrorMessage("sender_confirmation_required", 422)).toMatch(/confirmation/);
  });
});

describe("review reasons and unverified senders", () => {
  it("accepts a trimmed reason of 3 to 500 characters and says what is wrong otherwise", () => {
    expect(reviewReasonOf("  Spam  ")).toBe("Spam");
    expect(reviewReasonOf(" ab ")).toBeNull();
    expect(reviewReasonOf("x".repeat(501))).toBeNull();
    expect(reviewReasonError("ab")).toBe("Give a reason of at least 3 characters.");
    expect(reviewReasonError("x".repeat(501))).toBe("Keep the reason to 500 characters or fewer.");
    expect(reviewReasonError("Spam")).toBeNull();
  });

  it("treats mail held for a sender reason, or without an aligned pass, as unverified", () => {
    const passed = { reason: "unmatched", spfResult: "pass", dkimResult: null } as const;
    expect(senderUnverified(passed)).toBe(false);
    expect(senderUnverified({ ...passed, reason: "sender_mismatch" })).toBe(true);
    expect(senderUnverified({ ...passed, reason: "bad_token" })).toBe(true);
    expect(senderUnverified({ ...passed, spfResult: "pass_unaligned" })).toBe(true);
    expect(senderUnverified({ ...passed, spfResult: null })).toBe(true);
    expect(senderUnverified({ ...passed, spfResult: "neutral", dkimResult: "pass" })).toBe(false);
  });
});
