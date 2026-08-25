import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IdentityStartActions } from "./identity-start-actions";

const trackKycOnboarding = vi.fn();

vi.mock("@/lib/analytics/events", () => ({
  trackKycOnboarding: (...args: unknown[]) => trackKycOnboarding(...args),
}));

vi.mock("@/components/kyc", () => ({
  KycVerificationLauncher: ({ buttonLabel }: { buttonLabel: string }) => (
    <button type="button">{buttonLabel}</button>
  ),
}));

vi.mock("@/app/dashboard/verify-identity/actions", () => ({
  startKycVerification: vi.fn(),
}));

describe("IdentityStartActions", () => {
  it("tracks skip with source and keeps a safe next path", () => {
    render(
      <IdentityStartActions summary={null} next="/dashboard/watchlist" source="post_verify" />,
    );

    const skip = screen.getByRole("link", { name: /verify later/i });
    expect(skip).toHaveAttribute("href", "/dashboard/watchlist");
    skip.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(skip);
    expect(trackKycOnboarding).toHaveBeenCalledWith({
      event: "kyc_onboarding_skip",
      step: "why",
      source: "post_verify",
    });
  });

  it("hides skip on hard KYC gates", () => {
    render(<IdentityStartActions summary={null} next="/lot/demo/1" source="bid_gate" />);
    expect(
      screen.queryByRole("link", { name: /verify later|finish later/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify to continue bidding/i })).toBeVisible();
  });
});
