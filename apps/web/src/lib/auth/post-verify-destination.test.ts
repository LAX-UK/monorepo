import { describe, expect, it } from "vitest";
import { resolvePostVerifyDestination } from "./post-verify-destination";

describe("resolvePostVerifyDestination", () => {
  it("defaults to /dashboard when no persona signal exists", () => {
    expect(resolvePostVerifyDestination({})).toEqual({
      href: "/dashboard",
      label: "Go to dashboard",
    });
  });

  it("organisation persona from session routes to org onboarding", () => {
    expect(resolvePostVerifyDestination({ sessionPersona: "organisation" })).toEqual({
      href: "/onboarding/organisation",
      label: "Set up your organisation",
    });
  });

  it("individual persona from session routes to /dashboard", () => {
    expect(resolvePostVerifyDestination({ sessionPersona: "individual" })).toEqual({
      href: "/dashboard",
      label: "Go to dashboard",
    });
  });

  it("query persona is used when session has none", () => {
    expect(resolvePostVerifyDestination({ queryPersona: "organisation" })).toEqual({
      href: "/onboarding/organisation",
      label: "Set up your organisation",
    });
  });

  it("session persona wins over query persona", () => {
    expect(
      resolvePostVerifyDestination({
        queryPersona: "organisation",
        sessionPersona: "individual",
      }),
    ).toEqual({ href: "/dashboard", label: "Go to dashboard" });
  });

  it("safe ?next= wins over persona signal", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "/dashboard/sell/lots",
        sessionPersona: "organisation",
      }),
    ).toEqual({ href: "/dashboard/sell/lots", label: "Continue" });
  });

  it("unsafe ?next= is rejected and falls back to persona routing", () => {
    expect(
      resolvePostVerifyDestination({
        requestedNext: "//evil.example.com/path",
        sessionPersona: "organisation",
      }),
    ).toEqual({ href: "/onboarding/organisation", label: "Set up your organisation" });
  });

  it("organisation persona routes to dashboard when org module disabled", () => {
    expect(
      resolvePostVerifyDestination({
        sessionPersona: "organisation",
        orgModuleEnabled: false,
      }),
    ).toEqual({ href: "/dashboard", label: "Go to dashboard" });
  });

  it("unknown persona strings are ignored", () => {
    expect(
      resolvePostVerifyDestination({ queryPersona: "robot" as unknown as "individual" }),
    ).toEqual({ href: "/dashboard", label: "Go to dashboard" });
  });
});
