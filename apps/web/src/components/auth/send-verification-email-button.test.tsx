import { sendVerificationEmailForReturnPath } from "@/lib/auth/services/send-verification-email.service";
import { notify } from "@/lib/ui/notify";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SendVerificationEmailButton } from "./send-verification-email-button";

vi.mock("@/lib/auth/services/send-verification-email.service", () => ({
  sendVerificationEmailForReturnPath: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

describe("SendVerificationEmailButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the return path and reports success", async () => {
    vi.mocked(sendVerificationEmailForReturnPath).mockResolvedValue({ ok: true });
    render(<SendVerificationEmailButton email="buyer@example.com" next="/lot/example/lot-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Send verification email" }));

    await waitFor(() =>
      expect(sendVerificationEmailForReturnPath).toHaveBeenCalledWith({
        email: "buyer@example.com",
        next: "/lot/example/lot-1",
      }),
    );
    expect(notify.success).toHaveBeenCalledWith("Verification email sent");
  });

  it("reports a resend failure", async () => {
    vi.mocked(sendVerificationEmailForReturnPath).mockResolvedValue({
      ok: false,
      code: "verification_email_failed",
      message: "Could not send verification email.",
    });
    render(<SendVerificationEmailButton email="buyer@example.com" next="/lot/example/lot-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Send verification email" }));

    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith("Could not send verification email."),
    );
  });
});
