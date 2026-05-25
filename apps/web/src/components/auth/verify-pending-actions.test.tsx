import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { authClient } from "@/lib/auth-client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ error: null }),
  },
}));

vi.mock("@/lib/auth/verify-email-resend-callback.server", () => ({
  buildVerifyEmailResendCallbackUrl: vi.fn(
    async (email: string, next?: string | null, origin?: string) => {
      const base = (origin ?? "http://localhost:3000").replace(/\/$/, "");
      const params = new URLSearchParams({ email, next: next ?? "/dashboard" });
      return `${base}/verify-email?${params.toString()}`;
    },
  ),
}));

describe("VerifyPendingActions", () => {
  beforeEach(() => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ error: null });
  });

  it("defaults next to /dashboard when resending without explicit next", async () => {
    render(<VerifyPendingActions email="test@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /send again/i }));

    await waitFor(() => {
      expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
        email: "test@example.com",
        callbackURL: expect.stringMatching(
          /^http:\/\/localhost(?::\d+)?\/verify-email\?email=test%40example\.com&next=%2Fdashboard$/,
        ),
      });
    });
  });
});
