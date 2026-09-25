import { useConsent } from "@/lib/analytics/consent/context";
import { clearHostedReauthLoopGuard } from "@/lib/auth/step-up/use-step-up-coordinator";
import { runHostedPostLoginEffects } from "@/lib/bff/post-login-effects.client";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HostedLoginSync } from "./hosted-login-sync";

vi.mock("@/lib/bff/post-login-effects.client", () => ({
  runHostedPostLoginEffects: vi.fn(),
}));

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  clearHostedReauthLoopGuard: vi.fn(),
}));

vi.mock("@/lib/analytics/consent/context", () => ({
  useConsent: vi.fn(),
}));

describe("HostedLoginSync", () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/auth/post-login");
  });

  it("runs broadcast before consent snapshot and analytics after snapshot", async () => {
    window.history.replaceState(null, "", "/auth/post-login?auth_fresh=1&entry_intent=reauth");
    vi.mocked(useConsent)
      .mockReturnValueOnce({ snapshot: null } as unknown as ReturnType<typeof useConsent>)
      .mockReturnValue({
        snapshot: { analytics: true, marketing: false, version: 1 },
      } as unknown as ReturnType<typeof useConsent>);

    const { rerender } = render(<HostedLoginSync />);

    await waitFor(() => {
      expect(runHostedPostLoginEffects).toHaveBeenCalledWith(
        expect.objectContaining({ broadcastOnly: true, analyticsEnabled: false }),
      );
    });

    rerender(<HostedLoginSync />);

    await waitFor(() => {
      expect(runHostedPostLoginEffects).toHaveBeenCalledWith(
        expect.objectContaining({ analyticsOnly: true, analyticsEnabled: true }),
      );
    });
    expect(clearHostedReauthLoopGuard).toHaveBeenCalled();
  });
});
