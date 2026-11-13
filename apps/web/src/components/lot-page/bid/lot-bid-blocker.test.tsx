import { LotBidBlocker } from "@/components/lot-page/bid/lot-bid-blocker";
import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  send: vi.fn(),
  /** Set to make the service chunk fail to load. */
  chunkFails: false,
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: mocks.success, error: mocks.error },
}));

vi.mock("@/lib/auth/services/send-verification-email.service", () => ({
  get sendVerificationEmailForReturnPath() {
    if (mocks.chunkFails) throw new Error("chunk failed");
    return mocks.send;
  },
}));

const presentation: BidBlockerPresentation = {
  tone: "warning",
  title: "Verify your email to bid",
  detail: "We sent a link to you@example.com.",
  action: {
    kind: "email",
    email: "you@example.com",
    next: "/lot/a-lot/1",
    label: "Resend email",
  },
};

describe("LotBidBlocker email action", () => {
  beforeEach(() => {
    mocks.success.mockReset();
    mocks.error.mockReset();
    mocks.send.mockReset();
    mocks.chunkFails = false;
  });

  it("sends the email when pressed and says so", async () => {
    mocks.send.mockResolvedValue({ ok: true });
    render(<LotBidBlocker presentation={presentation} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Verification email sent"));
    expect(mocks.send).toHaveBeenCalledWith({ email: "you@example.com", next: "/lot/a-lot/1" });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("shows the service's message when sending fails", async () => {
    mocks.send.mockResolvedValue({ ok: false, code: "rate_limited", message: "Slow down." });
    render(<LotBidBlocker presentation={presentation} />);

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));

    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Slow down."));
  });

  it("reads as a failed send when the sending code cannot be fetched", async () => {
    mocks.chunkFails = true;
    render(<LotBidBlocker presentation={presentation} />);
    const button = screen.getByRole("button", { name: "Resend email" });

    fireEvent.click(button);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Could not send verification email. Please try again.",
      ),
    );
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy", "true"));
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
