import { IdentityOnboardingVerifyClient } from "@/app/(task)/onboarding/identity/verify/identity-onboarding-verify-client";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: "",
  refresh: vi.fn(),
  trackKycOnboarding: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));

vi.mock("@/app/dashboard/verify-identity/actions", () => ({
  startKycVerification: vi.fn(),
}));

vi.mock("@/lib/analytics/events", () => ({
  trackKycOnboarding: mocks.trackKycOnboarding,
}));

vi.mock("@/components/kyc", () => ({
  KycStatusPanel: ({ phase }: { phase: string }) => <output>{phase}</output>,
  KycVerificationLauncher: () => null,
  isKycAwaitingDecision: (summary: { latestSessionStatus?: string } | null) =>
    summary?.latestSessionStatus === "processing",
  isKycSessionContinuable: () => false,
  kycInitialPhase: (summary: { status?: string } | null) =>
    summary?.status === "pending" ? "processing" : "idle",
}));

describe("IdentityOnboardingVerifyClient", () => {
  beforeEach(() => {
    mocks.query = "";
    mocks.refresh.mockReset();
    mocks.trackKycOnboarding.mockReset();
    sessionStorage.clear();
  });

  it("restores submitted state and analytics after a redirect fallback", async () => {
    mocks.query = "kyc=complete";
    const props = {
      summary: {
        status: "pending",
        latestSessionStatus: "processing",
        latestSessionId: "session-123",
      } as never,
      next: "/dashboard",
      source: "direct" as const,
    };
    const { unmount } = render(
      <IdentityOnboardingVerifyClient
        summary={props.summary}
        next={props.next}
        source={props.source}
      />,
    );

    expect(await screen.findByText("submitted")).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.trackKycOnboarding).toHaveBeenCalledTimes(1);
    });
    expect(mocks.trackKycOnboarding).toHaveBeenCalledWith({
      event: "kyc_onboarding_submitted",
      step: "verify",
      source: "direct",
    });

    unmount();
    render(
      <IdentityOnboardingVerifyClient
        summary={props.summary}
        next={props.next}
        source={props.source}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("submitted")).toBeInTheDocument();
    });
    expect(mocks.trackKycOnboarding).toHaveBeenCalledTimes(1);
  });

  it("does not report submission without a provider return marker", () => {
    render(
      <IdentityOnboardingVerifyClient
        summary={{ status: "pending", latestSessionStatus: "processing" } as never}
        next="/dashboard"
        source="direct"
      />,
    );

    expect(screen.getByText("processing")).toBeInTheDocument();
    expect(mocks.trackKycOnboarding).not.toHaveBeenCalled();
  });
});
