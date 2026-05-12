import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { authClient } from "@/lib/auth-client";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ error: null }),
  },
}));

describe("VerifyPendingActions", () => {
  beforeEach(() => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({ error: null });
  });

  it("sends verification with absolute callbackURL on current origin", () => {
    render(<VerifyPendingActions email="test@example.com" next="/dashboard" />);

    fireEvent.click(screen.getByRole("button", { name: /send again/i }));

    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      callbackURL: expect.stringMatching(
        /^http:\/\/localhost(?::\d+)?\/verify-email\?email=test%40example\.com&next=%2Fdashboard$/,
      ),
    });
  });
});
