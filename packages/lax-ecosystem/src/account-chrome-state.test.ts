import { describe, expect, it } from "vitest";
import { mapShopMeToAccountChromeState } from "./account-chrome-state.js";

const destinations = {
  loginHref: "/login",
  registerHref: "/register",
  accountHref: "/account",
  logoutHref: "/logout",
  disabledAccountHref: "/account/disabled",
};

describe("mapShopMeToAccountChromeState", () => {
  it("never maps failed lookup to guest", () => {
    expect(
      mapShopMeToAccountChromeState({
        payload: null,
        sessionLookupOk: false,
        destinations,
      }).kind,
    ).toBe("unavailable");
  });

  it("maps authenticated and disabled payloads", () => {
    const authed = mapShopMeToAccountChromeState({
      payload: { authenticated: true, profile: { email: "a@lax.bid" } },
      sessionLookupOk: true,
      destinations,
    });
    expect(authed.kind).toBe("authenticated");
    if (authed.kind === "authenticated") {
      expect(authed.displayName).toBe("a@lax.bid");
      expect(authed.email).toBe("a@lax.bid");
    }

    const named = mapShopMeToAccountChromeState({
      payload: {
        authenticated: true,
        profile: { name: "Alex Collector", email: "alex@lax.bid" },
      },
      sessionLookupOk: true,
      destinations,
    });
    if (named.kind === "authenticated") {
      expect(named.displayName).toBe("Alex Collector");
      expect(named.email).toBe("alex@lax.bid");
    }

    const disabled = mapShopMeToAccountChromeState({
      payload: { authenticated: false, reason: "identity_disabled" },
      sessionLookupOk: true,
      destinations,
    });
    expect(disabled.kind).toBe("disabled");
  });

  it("preserves custom unavailable and disabled copy for presenters", () => {
    const unavailable = mapShopMeToAccountChromeState({
      payload: null,
      sessionLookupOk: false,
      destinations,
      copy: { unavailable: "Custom unavailable copy." },
    });
    expect(unavailable.kind).toBe("unavailable");
    if (unavailable.kind === "unavailable") {
      expect(unavailable.message).toBe("Custom unavailable copy.");
    }

    const disabled = mapShopMeToAccountChromeState({
      payload: { authenticated: false, reason: "identity_disabled" },
      sessionLookupOk: true,
      destinations,
      copy: { disabled: "Custom disabled copy." },
    });
    if (disabled.kind === "disabled") {
      expect(disabled.message).toBe("Custom disabled copy.");
    }
  });

  it("maps unauthenticated success to guest", () => {
    expect(
      mapShopMeToAccountChromeState({
        payload: { authenticated: false },
        sessionLookupOk: true,
        destinations,
      }).kind,
    ).toBe("guest");
  });
});
