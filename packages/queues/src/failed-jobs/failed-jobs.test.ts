import { describe, expect, it } from "vitest";
import { scrubErrorMessage, summariseError } from "./error-summary.js";
import { failedJobNameLabel, failedJobTypeInfo, knownFailedJobQueues } from "./job-types.js";
import { maskJobPayload, payloadLabel } from "./payload-mask.js";
import { retryAvailability } from "./retry-policy.js";
import { maskEmail, maskName, maskPhone, scrubText } from "./scrub.js";

describe("masking", () => {
  it("keeps the first letters of an email", () => {
    expect(maskEmail("lena@north.com")).toBe("l•••••@n•••••.com");
    expect(maskEmail("a.b@mail.co.uk")).toBe("a•••••@m•••••.uk");
  });

  it("shows a name as initials", () => {
    expect(maskName("Lena Fischer")).toBe("L. F•••");
    expect(maskName("Prince")).toBe("P•••");
    expect(maskName("  ")).toBe("•••••");
  });

  it("keeps the last three digits of a phone number", () => {
    expect(maskPhone("+44 7700 900123")).toBe("•••••123");
    expect(maskPhone("12")).toBe("•••••");
  });
});

describe("scrubText", () => {
  it("removes emails, bearer tokens, credential pairs, query strings and long tokens", () => {
    const text =
      "Failed for lena@north.com with Bearer abcdefghijklmnop1234 at https://api.example.com/v1/x?token=abc&b=2 key sk_live_abcdefgh12345678 api_key=hunter2hunter2";
    const clean = scrubText(text);
    expect(clean).not.toContain("lena@north.com");
    expect(clean).not.toContain("abcdefghijklmnop1234");
    expect(clean).not.toContain("token=abc");
    expect(clean).not.toContain("sk_live_abcdefgh12345678");
    expect(clean).not.toContain("hunter2");
    expect(clean).toContain("https://api.example.com/v1/x");
  });

  it("leaves identifiers and dates alone", () => {
    const text = "Lot 6f1c2d3e-aaaa-4bbb-8ccc-1234567890ab on 2026-11-01 failed";
    expect(scrubText(text)).toBe(text);
  });

  it("masks a phone number written with spaces", () => {
    expect(scrubText("Call +44 7700 900123 now")).toBe("Call •••••123 now");
  });
});

describe("error summary", () => {
  it("uses the first line and scrubs it", () => {
    expect(summariseError("Rejected: l@n.com\n  at send (x.ts:1)")).toBe(
      "Rejected: l•••••@n•••••.com",
    );
  });

  it("cuts a long line at a word with an ellipsis", () => {
    const long = `${"word ".repeat(60)}end`;
    const summary = summariseError(long);
    expect(summary.length).toBeLessThanOrEqual(161);
    expect(summary.endsWith("…")).toBe(true);
    expect(summary).not.toMatch(/wor…$/);
  });

  it("says so when nothing was recorded", () => {
    expect(summariseError(null)).toBe("No error was recorded.");
    expect(scrubErrorMessage("")).toBe("No error was recorded.");
  });

  it("caps and scrubs the full message", () => {
    const full = scrubErrorMessage(`mail to a@b.com\n${"x ".repeat(2_000)}`);
    expect(full).not.toContain("a@b.com");
    expect(full.length).toBeLessThanOrEqual(1_201);
  });
});

describe("maskJobPayload", () => {
  it("masks personal fields, keeps identifiers and counts what it leaves out", () => {
    const masked = maskJobPayload({
      to: "x",
      email: "lena@north.com",
      recipientName: "Lena Fischer",
      phone: "+44 7700 900123",
      lotId: "lot-14",
      amountPence: 900_000,
      template: "outbid",
      htmlBody: "<p>secret</p>",
      apiToken: "abc",
      note: "free text we do not know",
    });
    const byLabel = Object.fromEntries(masked.entries.map((e) => [e.label, e]));
    expect(byLabel.Email).toMatchObject({ value: "l•••••@n•••••.com", masked: true });
    expect(byLabel["Recipient name"]).toMatchObject({ value: "L. F•••", masked: true });
    expect(byLabel.Phone).toMatchObject({ value: "•••••123", masked: true });
    expect(byLabel["Lot ID"]).toMatchObject({ value: "lot-14", masked: false });
    expect(byLabel.Amount).toMatchObject({ value: "900000", masked: false });
    expect(byLabel.Template).toMatchObject({ value: "outbid" });
    const shown = JSON.stringify(masked.entries);
    expect(shown).not.toContain("secret");
    expect(shown).not.toContain("lena@north.com");
    expect(shown).not.toContain("free text");
    expect(masked.omitted).toBe(4);
  });

  it("walks nested objects and masks inside them", () => {
    const masked = maskJobPayload({ client: { email: "a@b.co", userId: "u1" } });
    expect(masked.entries.map((e) => e.value)).toEqual(["a•••••@b•••••.co", "u1"]);
  });

  it("scrubs identifier values that carry a credential", () => {
    const masked = maskJobPayload({ reference: "ref sk_live_abcdefgh12345678" });
    expect(masked.entries[0]?.value).not.toContain("sk_live");
  });

  it("returns nothing for a payload that is not an object", () => {
    expect(maskJobPayload(null)).toEqual({ entries: [], omitted: 0 });
    expect(maskJobPayload("text")).toEqual({ entries: [], omitted: 1 });
  });

  it("labels keys as sentences", () => {
    expect(payloadLabel("newHighestBidPence")).toBe("New highest bid");
    expect(payloadLabel("client.userId")).toBe("User ID");
  });
});

describe("job types", () => {
  it("describes known queues and falls back for unknown ones", () => {
    expect(failedJobTypeInfo("email")).toMatchObject({ label: "Email", mayRepeat: true });
    expect(failedJobTypeInfo("some-new-queue")).toMatchObject({
      label: "Some new queue",
      mayRepeat: true,
    });
    expect(knownFailedJobQueues().map((q) => q.id)).toContain("lot-lifecycle");
  });

  it("turns a job name into a phrase unless it only repeats the queue", () => {
    expect(failedJobNameLabel("email", "email:outbid-notice")).toBe("Outbid notice");
    expect(failedJobNameLabel("email", "email")).toBeNull();
    expect(failedJobNameLabel("email", null)).toBeNull();
  });
});

describe("retryAvailability", () => {
  it("allows a retry for an ordinary queue", () => {
    expect(retryAvailability("email", { actionsEnabled: true })).toEqual({ allowed: true });
  });

  it("never offers a retry for lot schedule jobs, and says why", () => {
    const result = retryAvailability("lot-lifecycle", { actionsEnabled: true });
    expect(result).toMatchObject({ allowed: false });
    expect(result.allowed === false && result.reason).toContain("open or close a lot twice");
  });

  it("refuses everything while the kill switch is off", () => {
    const result = retryAvailability("email", { actionsEnabled: false });
    expect(result.allowed === false && result.reason).toContain("switched off");
  });
});
