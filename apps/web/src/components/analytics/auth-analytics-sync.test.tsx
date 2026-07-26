import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthAnalyticsSync } from "./auth-analytics-sync";

const mocks = vi.hoisted(() => ({
  trackLogin: vi.fn(),
  trackSignUp: vi.fn(),
  resolveOAuthOutcome: vi.fn(),
  consent: { snapshot: { analytics: true, marketing: true } },
}));

vi.mock("@/lib/analytics/consent/context", () => ({
  useConsent: () => mocks.consent,
}));
vi.mock("@/lib/analytics/events", () => ({
  trackLogin: mocks.trackLogin,
  trackSignUp: mocks.trackSignUp,
}));
vi.mock("@/lib/data/http/marketing-oauth-outcome.client", () => ({
  resolveOAuthOutcome: mocks.resolveOAuthOutcome,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

beforeEach(() => {
  mocks.trackLogin.mockReset();
  mocks.trackSignUp.mockReset();
  mocks.resolveOAuthOutcome.mockReset();
  mocks.consent.snapshot.analytics = true;
  mocks.consent.snapshot.marketing = true;
  window.history.replaceState({}, "", "/dashboard?oauth_provider=google&utm_source=paid");
});

describe("AuthAnalyticsSync", () => {
  it("uses the server outcome, removes the marker, and tracks once", async () => {
    mocks.resolveOAuthOutcome.mockResolvedValue({ event: "signup", method: "google" });
    const { rerender } = render(<AuthAnalyticsSync />);
    await waitFor(() => expect(mocks.trackSignUp).toHaveBeenCalledWith("google"));
    expect(mocks.resolveOAuthOutcome).toHaveBeenCalledWith("google");
    expect(window.location.search).toBe("?utm_source=paid");
    rerender(<AuthAnalyticsSync />);
    expect(mocks.trackSignUp).toHaveBeenCalledTimes(1);
    expect(mocks.trackLogin).not.toHaveBeenCalled();
  });

  it("does not emit a browser event for a replayed outcome", async () => {
    mocks.resolveOAuthOutcome.mockResolvedValue({ event: "ignored", method: "google" });
    render(<AuthAnalyticsSync />);
    await waitFor(() => expect(mocks.resolveOAuthOutcome).toHaveBeenCalled());
    expect(mocks.trackSignUp).not.toHaveBeenCalled();
    expect(mocks.trackLogin).not.toHaveBeenCalled();
  });

  it("waits for both consents before resolving the outcome", async () => {
    mocks.consent.snapshot.analytics = false;
    mocks.consent.snapshot.marketing = false;
    mocks.resolveOAuthOutcome.mockResolvedValue({ event: "login", method: "google" });
    const { rerender } = render(<AuthAnalyticsSync />);
    expect(mocks.resolveOAuthOutcome).not.toHaveBeenCalled();

    mocks.consent.snapshot.analytics = true;
    mocks.consent.snapshot.marketing = true;
    rerender(<AuthAnalyticsSync />);
    await waitFor(() => expect(mocks.trackLogin).toHaveBeenCalledWith("google"));
  });
});
