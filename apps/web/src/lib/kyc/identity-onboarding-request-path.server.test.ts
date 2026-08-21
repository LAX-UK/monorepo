import { resolveIdentityOnboardingRequestPath } from "@/lib/kyc/identity-onboarding-request-path.server";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("resolveIdentityOnboardingRequestPath", () => {
  beforeEach(() => {
    vi.mocked(headers).mockReset();
  });

  it("preserves the current step and query for authentication", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        "x-pathname": "/onboarding/identity/verify",
        "x-search": "?next=%2Flot%2Fexample%2F123&source=direct",
      }) as never,
    );

    await expect(resolveIdentityOnboardingRequestPath()).resolves.toBe(
      "/onboarding/identity/verify?next=%2Flot%2Fexample%2F123&source=direct",
    );
  });

  it("falls back when middleware headers are unavailable or outside the flow", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-pathname": "/dashboard" }) as never);
    await expect(resolveIdentityOnboardingRequestPath()).resolves.toBe("/onboarding/identity");
  });
});
