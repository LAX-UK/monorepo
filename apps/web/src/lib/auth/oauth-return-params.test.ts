import { describe, expect, it } from "vitest";
import {
  buildOAuthCallbackUrl,
  parseOAuthProvider,
  withOAuthReturnParams,
} from "./oauth-return-params";

describe("OAuth return params", () => {
  it("accepts only supported providers", () => {
    expect(parseOAuthProvider("google")).toBe("google");
    expect(parseOAuthProvider("apple")).toBe("apple");
    expect(parseOAuthProvider("email")).toBeNull();
  });

  it("builds an OAuth callback with marketing passthrough values", () => {
    expect(
      buildOAuthCallbackUrl({
        webOrigin: "https://lax.bid/",
        next: "/dashboard",
        provider: "google",
        source: new URLSearchParams(
          "utm_source=paid&gbraid=gb-1&_gl=linker&gad_source=1&discard=1",
        ),
      }),
    ).toBe(
      "https://lax.bid/auth/social-callback?next=%2Fdashboard&oauth_provider=google&utm_source=paid&gbraid=gb-1&_gl=linker&gad_source=1",
    );
  });

  it("preserves campaign and linker values while discarding unrelated keys", () => {
    expect(
      withOAuthReturnParams("/dashboard?welcome=1", {
        oauth_provider: "google",
        utm_source: "newsletter",
        gbraid: "gb-1",
        _gl: "linker",
        gad_source: "1",
        arbitrary: "discard",
      }),
    ).toBe(
      "/dashboard?welcome=1&utm_source=newsletter&gbraid=gb-1&_gl=linker&gad_source=1&oauth_provider=google",
    );
  });
});
