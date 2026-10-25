import { resendOnsiteEventPass } from "@/lib/data/http/onsite-event-check-in.client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type GuestActionTarget, useGuestActions } from "./use-guest-actions";

const refresh = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/data/http/onsite-event-check-in.client", () => ({
  resendOnsiteEventPass: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: (title: string) => notifySuccess(title),
    error: (title: string) => notifyError(title),
  },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const guest: GuestActionTarget = {
  id: "rsvp-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

function Harness({ target }: { target: GuestActionTarget }) {
  const actions = useGuestActions("preview-night");
  return (
    <>
      {actions.actionsFor(target).map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={Boolean(action.disabledReason)}
          onClick={() => action.onSelect?.()}
        >
          {action.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

describe("useGuestActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resendOnsiteEventPass).mockResolvedValue(false);
  });

  it("offers to resend the pass and to copy the email address", () => {
    render(<Harness target={guest} />);
    expect(screen.getByRole("button", { name: "Resend pass" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Copy email address" })).toBeEnabled();
  });

  it("asks before resending, naming the guest and where the email goes", async () => {
    render(<Harness target={guest} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend pass" }));

    expect(await screen.findByText("Resend Ada Lovelace's pass?")).toBeInTheDocument();
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
    expect(resendOnsiteEventPass).not.toHaveBeenCalled();
  });

  it("resends once confirmed, then tells the person it was sent", async () => {
    render(<Harness target={guest} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend pass" }));
    await screen.findByText("Resend Ada Lovelace's pass?");

    fireEvent.click(screen.getAllByRole("button", { name: "Resend pass" }).at(-1) as HTMLElement);

    await waitFor(() => {
      expect(resendOnsiteEventPass).toHaveBeenCalledWith("preview-night", "rsvp-1");
    });
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Pass resent to Ada Lovelace"));
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps a failed resend in the dialog with the reason", async () => {
    vi.mocked(resendOnsiteEventPass).mockRejectedValue(new Error("The mail service is down"));
    render(<Harness target={guest} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend pass" }));
    await screen.findByText("Resend Ada Lovelace's pass?");

    fireEvent.click(screen.getAllByRole("button", { name: "Resend pass" }).at(-1) as HTMLElement);

    expect(await screen.findByText("The mail service is down")).toBeInTheDocument();
    expect(screen.getByText("Resend Ada Lovelace's pass?")).toBeInTheDocument();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it("copies the email address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<Harness target={guest} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy email address" }));

    expect(writeText).toHaveBeenCalledWith("ada@example.com");
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Email address copied"));
  });
});
