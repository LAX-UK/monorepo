import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { applySilentSignInEdge } from "./apply-silent-sign-in-edge.js";

describe("applySilentSignInEdge", () => {
  const prev = process.env.SILENT_SSO_ENABLED;

  afterEach(() => {
    process.env.SILENT_SSO_ENABLED = prev;
  });

  it("returns null when disabled", () => {
    process.env.SILENT_SSO_ENABLED = "false";
    const request = new NextRequest("https://lax.bid/catalog");
    expect(applySilentSignInEdge(request)).toBeNull();
  });

  it("redirects eligible document navigations to sso-probe", () => {
    process.env.SILENT_SSO_ENABLED = "true";
    const request = new NextRequest("https://lax.bid/catalog", {
      headers: {
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "user-agent": "Mozilla/5.0",
      },
    });
    const response = applySilentSignInEdge(request);
    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toContain("/api/auth/sso-probe?next=");
  });
});
