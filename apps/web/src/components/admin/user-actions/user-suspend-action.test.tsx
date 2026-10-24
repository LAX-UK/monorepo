import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { UserStaffRole } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserSuspendAction } from "./user-suspend-action";

const USER_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const REASON = "Repeated chargebacks, confirmed with the payments team.";

const refresh = vi.fn();
const suspendAction = vi.fn();
const unsuspendAction = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();
const notifyInfo = vi.fn();

// Radix's dialog portals, traps focus and animates, which is slow and noisy in jsdom. This
// stand-in keeps the open/close contract so the tests still cover what the dialog asks and does.
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminSuspendUserResultAction: (...args: unknown[]) => suspendAction(...args),
  adminUnsuspendUserResultAction: (...args: unknown[]) => unsuspendAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: (title: string) => notifySuccess(title),
    error: (title: string) => notifyError(title),
    info: (title: string) => notifyInfo(title),
  },
}));

function renderAs(staffRole: UserStaffRole, ui: ReactNode) {
  return render(
    <ViewerCapabilitiesProvider user={{ role: "staff", staffRole, name: "Sam" }}>
      {ui}
    </ViewerCapabilitiesProvider>,
  );
}

function confirmButton() {
  const buttons = screen.getAllByRole("button", { name: "Suspend account" });
  return buttons[buttons.length - 1] as HTMLButtonElement;
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
}

describe("UserSuspendAction", () => {
  beforeEach(() => {
    for (const fn of [
      refresh,
      suspendAction,
      unsuspendAction,
      notifySuccess,
      notifyError,
      notifyInfo,
    ]) {
      fn.mockReset();
    }
  });

  it("keeps confirm disabled until the reason and the phrase are both given", () => {
    renderAs("support_concierge", <UserSuspendAction userId={USER_ID} suspendedAt={null} />);
    openDialog();
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "SUSPEND" } });
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason for the suspension"), {
      target: { value: "too short" },
    });
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Reason for the suspension"), {
      target: { value: REASON },
    });
    expect(confirmButton().disabled).toBe(false);
  });

  it("sends the trimmed reason the person typed, not a fixed one", async () => {
    suspendAction.mockResolvedValue({ ok: true });
    renderAs("support_concierge", <UserSuspendAction userId={USER_ID} suspendedAt={null} />);
    openDialog();
    fireEvent.change(screen.getByLabelText("Reason for the suspension"), {
      target: { value: `  ${REASON}  ` },
    });
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "SUSPEND" } });

    fireEvent.click(confirmButton());

    await waitFor(() => expect(suspendAction).toHaveBeenCalledWith(USER_ID, { reason: REASON }));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Suspended"));
    expect(refresh).toHaveBeenCalled();
  });

  it("starts re-authentication instead of showing an error when the API asks for a fresh sign-in", async () => {
    suspendAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    renderAs("support_concierge", <UserSuspendAction userId={USER_ID} suspendedAt={null} />);
    openDialog();
    fireEvent.change(screen.getByLabelText("Reason for the suspension"), {
      target: { value: REASON },
    });
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "SUSPEND" } });

    fireEvent.click(confirmButton());

    await waitFor(() => expect(notifyInfo).toHaveBeenCalledWith("Confirm it is you to continue"));
    expect(notifyError).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows other failures as errors", async () => {
    suspendAction.mockResolvedValue({ ok: false, error: "You cannot suspend yourself" });
    renderAs("support_concierge", <UserSuspendAction userId={USER_ID} suspendedAt={null} />);
    openDialog();
    fireEvent.change(screen.getByLabelText("Reason for the suspension"), {
      target: { value: REASON },
    });
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "SUSPEND" } });

    fireEvent.click(confirmButton());

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith("You cannot suspend yourself"));
  });

  it("unsuspends without asking for a reason", async () => {
    unsuspendAction.mockResolvedValue({ ok: true });
    renderAs("support_concierge", <UserSuspendAction userId={USER_ID} suspendedAt="2026-01-01" />);

    fireEvent.click(screen.getByRole("button", { name: "Unsuspend" }));

    await waitFor(() => expect(unsuspendAction).toHaveBeenCalledWith(USER_ID));
    expect(screen.queryByLabelText("Reason for the suspension")).toBeNull();
  });
});
