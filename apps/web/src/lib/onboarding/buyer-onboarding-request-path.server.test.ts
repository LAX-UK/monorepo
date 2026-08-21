import { resolveBuyerOnboardingRequestPath } from "@/lib/onboarding/buyer-onboarding-request-path.server";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("resolveBuyerOnboardingRequestPath", () => {
  beforeEach(() => {
    vi.mocked(headers).mockReset();
  });

  it("preserves the current step and query for authentication", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        "x-pathname": "/onboarding/recommendations",
        "x-search": "?next=%2Fdashboard%2Fwatchlist&source=post_verify",
      }) as never,
    );

    await expect(resolveBuyerOnboardingRequestPath()).resolves.toBe(
      "/onboarding/recommendations?next=%2Fdashboard%2Fwatchlist&source=post_verify",
    );
  });

  it("falls back when middleware headers are unavailable or outside the flow", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-pathname": "/dashboard" }) as never);
    await expect(resolveBuyerOnboardingRequestPath()).resolves.toBe("/onboarding/interests");
  });
});
