import { describe, expect, it } from "vitest";
import {
  MAX_INVITE_BATCH,
  isValidInviteEmail,
  mergeInviteEmails,
  parseInviteEmailList,
  partitionInviteEmails,
} from "./parse-invite-email-list";

describe("parseInviteEmailList", () => {
  it("splits comma-separated emails", () => {
    expect(parseInviteEmailList("a@x.com, b@y.com")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("splits newlines and dedupes", () => {
    expect(parseInviteEmailList("A@X.com\na@x.com\nb@y.com")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("trims and lowercases", () => {
    expect(parseInviteEmailList("  Foo@Bar.COM  ")).toEqual(["foo@bar.com"]);
  });
});

describe("partitionInviteEmails", () => {
  it("separates valid and invalid addresses", () => {
    expect(partitionInviteEmails("good@x.com, not-an-email, also@bad")).toEqual({
      valid: ["good@x.com"],
      invalid: ["not-an-email", "also@bad"],
    });
  });
});

describe("isValidInviteEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidInviteEmail("User@Example.com")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidInviteEmail("not-an-email")).toBe(false);
  });
});

describe("mergeInviteEmails", () => {
  it("dedupes case-insensitively", () => {
    expect(mergeInviteEmails(["a@x.com"], ["A@X.com", "b@y.com"])).toEqual({
      merged: ["a@x.com", "b@y.com"],
      truncated: false,
    });
  });

  it("caps at MAX_INVITE_BATCH", () => {
    const existing = Array.from({ length: MAX_INVITE_BATCH }, (_, i) => `u${i}@x.com`);
    expect(mergeInviteEmails(existing, ["new@y.com"])).toEqual({
      merged: existing,
      truncated: true,
    });
  });
});
