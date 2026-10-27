import { postLoginHandoffHref } from "@/lib/auth/post-login-handoff";
import { describe, expect, it } from "vitest";

describe("postLoginHandoffHref", () => {
  it("preserves a safe intended destination for the server decision", () => {
    expect(
      postLoginHandoffHref("/bids?filter=winning", {
        withWelcomeBack: true,
      }),
    ).toBe("/auth/post-login?next=%2Fbids%3Ffilter%3Dwinning&welcome=back");
  });

  it("drops unsafe destinations", () => {
    expect(postLoginHandoffHref("//evil.example")).toBe("/auth/post-login");
  });
});
