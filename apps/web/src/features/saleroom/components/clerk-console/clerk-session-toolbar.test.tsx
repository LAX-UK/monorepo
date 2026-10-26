import { ClerkSessionToolbar } from "@/features/saleroom/components/clerk-console/clerk-session-toolbar";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { close, refresh } = vi.hoisted(() => ({
  close: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminSaleroomCloseAction: close,
  adminSaleroomGoLiveAction: vi.fn(),
  adminSaleroomPauseAction: vi.fn(),
  adminSaleroomResumeAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

describe("ClerkSessionToolbar", () => {
  beforeEach(() => {
    close.mockReset();
    refresh.mockReset();
  });

  it("asks before closing the session, and does nothing if the clerk keeps it open", () => {
    render(<ClerkSessionToolbar saleId="sale-1" livePhase="selling" sessionStatus="live" />);

    fireEvent.click(screen.getByRole("button", { name: "Close session" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Close the saleroom session?");

    fireEvent.click(screen.getByRole("button", { name: "Keep session open" }));
    expect(close).not.toHaveBeenCalled();
  });

  it("closes the session once confirmed", async () => {
    close.mockResolvedValue({ ok: true, data: undefined });
    render(<ClerkSessionToolbar saleId="sale-1" livePhase="selling" sessionStatus="live" />);

    fireEvent.click(screen.getByRole("button", { name: "Close session" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close session" }),
    );

    await waitFor(() => expect(close).toHaveBeenCalledWith({ saleId: "sale-1" }));
  });

  it("offers Go live before the sale and Resume while paused", () => {
    const { rerender } = render(
      <ClerkSessionToolbar saleId="sale-1" livePhase="setup" sessionStatus="none" />,
    );
    expect(screen.getByRole("button", { name: "Go live" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Close session" })).not.toBeInTheDocument();

    rerender(<ClerkSessionToolbar saleId="sale-1" livePhase="paused" sessionStatus="paused" />);
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });
});
