import { describe, expect, it } from "vitest";
import { parseInviteEmailList, partitionInviteEmails } from "./parse-invite-email-list";

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
