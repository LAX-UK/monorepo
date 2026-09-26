import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { describe, expect, it } from "vitest";

describe("buildHostedLoginStartHref", () => {
  it("defaults next to dashboard", () => {
    expect(buildHostedLoginStartHref()).toBe("/api/auth/login?next=%2Fdashboard");
  });

  it("preserves safe next and signup intent", () => {
    expect(buildHostedLoginStartHref({ next: "/lot/foo", intent: "signup" })).toBe(
      "/api/auth/login?next=%2Flot%2Ffoo&intent=signup",
    );
  });

  it("rejects unsafe next paths", () => {
    expect(buildHostedLoginStartHref({ next: "//evil.com" })).toBe(
      "/api/auth/login?next=%2Fdashboard",
    );
  });
});
