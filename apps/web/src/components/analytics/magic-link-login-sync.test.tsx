import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MagicLinkLoginSync } from "./magic-link-login-sync";

const mocks = vi.hoisted(() => ({
  trackLogin: vi.fn(),
  consent: { snapshot: { analytics: true, marketing: true } },
}));

vi.mock("@/lib/analytics/consent/context", () => ({
  useConsent: () => mocks.consent,
}));
vi.mock("@/lib/analytics/events", () => ({
  trackLogin: mocks.trackLogin,
}));

beforeEach(() => {
  mocks.trackLogin.mockReset();
  window.history.replaceState(
    {},
    "",
    "/auth/activate/set-password?auth_method=magic_link&next=%2Fdashboard",
  );
});

describe("MagicLinkLoginSync", () => {
  it("tracks once and removes the one-time marker", async () => {
    const { rerender } = render(<MagicLinkLoginSync />);
    await waitFor(() => expect(mocks.trackLogin).toHaveBeenCalledWith("magic_link"));
    expect(window.location.search).toBe("?next=%2Fdashboard");
    rerender(<MagicLinkLoginSync />);
    expect(mocks.trackLogin).toHaveBeenCalledTimes(1);
  });

  it("does not track a direct visit without a verification marker", async () => {
    window.history.replaceState({}, "", "/auth/activate/set-password");
    render(<MagicLinkLoginSync />);
    await Promise.resolve();
    expect(mocks.trackLogin).not.toHaveBeenCalled();
  });
});
