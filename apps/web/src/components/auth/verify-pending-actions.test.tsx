import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/auth-error-code";
import { resendVerificationEmailFromPending } from "@/lib/auth/services/send-verification-email.service";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/services/send-verification-email.service", () => ({
  resendVerificationEmailFromPending: vi.fn(),
}));

describe("VerifyPendingActions", () => {
  beforeEach(() => {
    vi.mocked(resendVerificationEmailFromPending).mockResolvedValue({ ok: true });
  });

  it("resends verification email with email, next, and web origin", async () => {
    render(<VerifyPendingActions email="test@example.com" next="/onboarding" />);

    fireEvent.click(screen.getByRole("button", { name: /send again/i }));

    await waitFor(() => {
      expect(resendVerificationEmailFromPending).toHaveBeenCalledWith({
        email: "test@example.com",
        next: "/onboarding",
        webOrigin: "http://localhost:3000",
      });
    });
  });

  it("shows service error message when resend fails", async () => {
    vi.mocked(resendVerificationEmailFromPending).mockResolvedValue({
      ok: false,
      code: "verification_email_failed",
      message: AUTH_ERROR_MESSAGES.verification_email_failed,
    });

    render(<VerifyPendingActions email="test@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /send again/i }));

    await waitFor(() => {
      expect(screen.getByText(AUTH_ERROR_MESSAGES.verification_email_failed)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /send again/i })).not.toBeDisabled();
  });
});
