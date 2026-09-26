import { describe, expect, it } from "vitest";
import { classifySilentCallback } from "./callback-outcome.js";
import { evaluateSilentSignInEligibility } from "./eligibility.js";
import type { CookieJar } from "./ports/cookie-jar.js";
import { isDocumentNavigation, isLikelyCrawler, isPrefetch } from "./request-signals.js";
import { createSilentSignInCookieSpec } from "./silent-sign-in-cookies.js";
import { selectSilentSignInStrategy } from "./strategy.js";

function memoryJar(initial: Record<string, string> = {}): CookieJar {
  const store = new Map(Object.entries(initial));
  return {
    get: (name) => store.get(name),
    set: (name, value) => {
      store.set(name, value);
    },
    delete: (name) => {
      store.delete(name);
    },
  };
}

const cookieNames = createSilentSignInCookieSpec("shop_sso");

function eligibleRequest(
  overrides: Partial<{ pathname: string; hasProductSession: boolean }> = {},
) {
  return {
    method: "GET",
    pathname: overrides.pathname ?? "/catalog",
    getHeader: (name: string) => {
      if (name === "sec-fetch-mode") return "navigate";
      if (name === "sec-fetch-dest") return "document";
      return null;
    },
    userAgent: "Mozilla/5.0",
    hasProductSession: overrides.hasProductSession ?? false,
  };
}

describe("request signals", () => {
  it("detects document navigation", () => {
    expect(
      isDocumentNavigation("GET", (h) =>
        h === "sec-fetch-mode" ? "navigate" : h === "sec-fetch-dest" ? "document" : null,
      ),
    ).toBe(true);
    expect(isDocumentNavigation("POST", () => "navigate")).toBe(false);
  });

  it("detects prefetch", () => {
    expect(isPrefetch((h) => (h === "sec-purpose" ? "prefetch" : null))).toBe(true);
  });

  it("detects crawlers", () => {
    expect(isLikelyCrawler("Googlebot/2.1")).toBe(true);
    expect(isLikelyCrawler("Mozilla/5.0")).toBe(false);
  });
});

describe("classifySilentCallback", () => {
  it("maps login_required to no_idp_session", () => {
    expect(classifySilentCallback("login_required").kind).toBe("no_idp_session");
  });
  it("treats missing error as success", () => {
    expect(classifySilentCallback(null).kind).toBe("success");
  });
});

describe("evaluateSilentSignInEligibility", () => {
  it("probes when eligible", () => {
    const result = evaluateSilentSignInEligibility({
      request: eligibleRequest(),
      cookieJar: memoryJar(),
      cookieNames,
      skipPathPrefixes: ["/login"],
    });
    expect(result.kind).toBe("probe");
  });

  it("skips when suppressed", () => {
    const result = evaluateSilentSignInEligibility({
      request: eligibleRequest(),
      cookieJar: memoryJar({ [cookieNames.suppressed]: "1" }),
      cookieNames,
      skipPathPrefixes: [],
    });
    expect(result).toEqual({ kind: "skip", reason: "suppressed" });
  });

  it("skips skip paths", () => {
    const result = evaluateSilentSignInEligibility({
      request: eligibleRequest({ pathname: "/login" }),
      cookieJar: memoryJar(),
      cookieNames,
      skipPathPrefixes: ["/login"],
    });
    expect(result.kind).toBe("skip");
  });
});

describe("selectSilentSignInStrategy", () => {
  it("defaults to redirect", () => {
    expect(selectSilentSignInStrategy({ fedcmEnabled: false })).toBe("redirect");
  });
  it("selects fedcm when enabled", () => {
    expect(selectSilentSignInStrategy({ fedcmEnabled: true })).toBe("fedcm");
  });
});
