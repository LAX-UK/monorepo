import { ClerkSessionToolbar } from "@/features/saleroom/components/clerk-console/clerk-session-toolbar";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { close, pause, refresh } = vi.hoisted(() => ({
  close: vi.fn(),
  pause: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/features/saleroom/lib/clerk-commands.client", () => ({
  clerkClose: close,
  clerkGoLive: vi.fn(),
  clerkPause: pause,
  clerkResume: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

describe("ClerkSessionToolbar", () => {
  beforeEach(() => {
    close.mockReset();
    pause.mockReset();
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

  it("holds Pause until the server has been asked again, then follows what it says", async () => {
    let finishPause: (value: { ok: true; data: undefined }) => void = () => {};
    pause.mockReturnValue(
      new Promise((resolve) => {
        finishPause = resolve;
      }),
    );
    let finishConfirm: () => void = () => {};
    const confirmFromServer = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishConfirm = resolve;
        }),
    );
    render(
      <ClerkSessionToolbar
        saleId="sale-1"
        livePhase="selling"
        sessionStatus="live"
        confirmFromServer={confirmFromServer}
      />,
    );
    const controls = screen.getByRole("region", { name: "Session controls" });

    fireEvent.click(within(controls).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(pause).toHaveBeenCalledWith({ saleId: "sale-1" }));
    expect(within(controls).getByRole("button", { name: /paus/i })).toBeDisabled();
    expect(within(controls).getByRole("button", { name: "Close session" })).toBeDisabled();

    // The server took the pause; the console has not yet heard what state the room is in.
    finishPause({ ok: true, data: undefined });
    await waitFor(() => expect(confirmFromServer).toHaveBeenCalledTimes(1));
    expect(within(controls).getByRole("button", { name: /paus/i })).toBeDisabled();

    finishConfirm();
    await waitFor(() =>
      expect(within(controls).getByRole("button", { name: "Close session" })).toBeEnabled(),
    );
  });

  it("asks the server again when it refuses a control, so a stale Pause is not offered twice", async () => {
    pause.mockResolvedValue({ ok: false, error: "Saleroom must be live to pause" });
    const confirmFromServer = vi.fn().mockResolvedValue(true);
    render(
      <ClerkSessionToolbar
        saleId="sale-1"
        livePhase="selling"
        sessionStatus="live"
        confirmFromServer={confirmFromServer}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(confirmFromServer).toHaveBeenCalledTimes(1));
  });
});
