import { describe, expect, it } from "vitest";
import { authorizeParamsForEntry, resolveHostedAuthEntry } from "./auth-entry-intent.server.js";

describe("auth-entry-intent", () => {
  it("maps sell funnel to signup screen with create prompt", () => {
    const sellEntry = resolveHostedAuthEntry(new URLSearchParams("intent=sell"));
    expect(sellEntry).toMatchObject({ screen: "signup", funnel: "sell", reauth: false });
    expect(authorizeParamsForEntry(sellEntry)).toEqual({ prompt: "create" });
  });

  it("maps reauth to login prompt without hosted chrome", () => {
    const reauthEntry = resolveHostedAuthEntry(new URLSearchParams("intent=reauth"));
    expect(authorizeParamsForEntry(reauthEntry)).toEqual({ prompt: "login" });
  });

  it("parses invite and switch login", () => {
    const params = new URLSearchParams("invite=abcdefghijklmnop&switch=1&next=%2Fdashboard");
    expect(resolveHostedAuthEntry(params)).toMatchObject({
      inviteToken: "abcdefghijklmnop",
      forceLoginPrompt: true,
      nextPath: "/dashboard",
      screen: "login",
    });
  });
});
