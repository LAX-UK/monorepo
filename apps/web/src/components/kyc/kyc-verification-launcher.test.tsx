import { KycVerificationLauncher } from "@/components/kyc/kyc-verification-launcher";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { createVeriffFrame } = vi.hoisted(() => ({
  createVeriffFrame: vi.fn(),
}));

vi.mock("@veriff/incontext-sdk", () => ({
  MESSAGES: { FINISHED: "FINISHED", SUBMITTED: "SUBMITTED", CANCELED: "CANCELED" },
  createVeriffFrame,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("KycVerificationLauncher", () => {
  it("resumes Veriff session from sessionStorage on mount", async () => {
    sessionStorage.setItem("@veriff-session-url", "https://veriff.test/session");
    const onStartSession = vi.fn();
    render(
      <KycVerificationLauncher
        returnUrl="https://test.lax.bid/dashboard/verify-identity"
        onStartSession={onStartSession}
        kycSummary={{ status: "unverified", requiresKyc: false } as never}
      />,
    );
    await waitFor(() => {
      expect(createVeriffFrame).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://veriff.test/session" }),
      );
    });
    sessionStorage.removeItem("@veriff-session-url");
  });

  it("shows cancel message when Veriff emits CANCELED", async () => {
    createVeriffFrame.mockImplementation(({ onEvent }: { onEvent: (msg: string) => void }) => {
      onEvent("CANCELED");
    });
    const onStartSession = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://veriff.test/new",
    });
    render(
      <KycVerificationLauncher
        returnUrl="https://test.lax.bid/dashboard/verify-identity"
        onStartSession={onStartSession}
        kycSummary={{ status: "unverified", requiresKyc: false } as never}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start verification/i }));
    await waitFor(() => {
      expect(screen.getByText(/verification was canceled/i)).toBeInTheDocument();
    });
  });
});
