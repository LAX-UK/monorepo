import { ViewerCapabilitiesProvider } from "@/lib/auth/capabilities";
import type { UserStaffRole } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserTwoFactorResetAction } from "./user-two-factor-reset-action";

const USER_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const REASON = "Lost phone and backup codes, identity checked by video call.";

const refresh = vi.fn();
const resetAction = vi.fn();
const notifySuccess = vi.fn();
const notifyError = vi.fn();

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
  adminResetTwoFactorResultAction: (...args: unknown[]) => resetAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: (title: string) => notifySuccess(title),
    error: (title: string) => notifyError(title),
  },
}));

function renderAs(staffRole: UserStaffRole, ui: ReactNode) {
  return render(
    <ViewerCapabilitiesProvider user={{ role: "staff", staffRole, name: "Sam" }}>
      {ui}
    </ViewerCapabilitiesProvider>,
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Reset two-step verification" }));
}

function confirmButton() {
  const buttons = screen.getAllByRole("button", { name: "Reset two-step verification" });
  return buttons[buttons.length - 1] as HTMLButtonElement;
}

describe("UserTwoFactorResetAction", () => {
  beforeEach(() => {
    refresh.mockReset();
    resetAction.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
  });

  it.each<UserStaffRole>(["super_admin", "support_concierge"])("is offered to %s", (staffRole) => {
    renderAs(staffRole, <UserTwoFactorResetAction userId={USER_ID} />);
    expect(screen.getByRole("button", { name: "Reset two-step verification" })).toBeTruthy();
  });

  it.each<UserStaffRole>(["client_advisor", "finance_ops", "staff_viewer"])(
    "is hidden from %s",
    (staffRole) => {
      renderAs(staffRole, <UserTwoFactorResetAction userId={USER_ID} />);
      expect(screen.queryByRole("button", { name: "Reset two-step verification" })).toBeNull();
    },
  );

  it("explains what happens and keeps confirm disabled until the reason and phrase are given", () => {
    renderAs("support_concierge", <UserTwoFactorResetAction userId={USER_ID} />);
    openDialog();

    expect(screen.getByText("They are signed out on every device.")).toBeTruthy();
    expect(screen.getByText("We email them that LAX support reset it.")).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);

    const reason = screen.getByLabelText("Reason for the reset");
    const phrase = screen.getByLabelText(/to confirm/);
    fireEvent.change(phrase, { target: { value: "RESET" } });
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(reason, { target: { value: "too short" } });
    expect(confirmButton().disabled).toBe(true);

    fireEvent.change(reason, { target: { value: REASON } });
    expect(confirmButton().disabled).toBe(false);
  });

  it("sends the trimmed reason, then confirms and refreshes the page", async () => {
    resetAction.mockResolvedValue({ ok: true });
    renderAs("support_concierge", <UserTwoFactorResetAction userId={USER_ID} />);
    openDialog();
    fireEvent.change(screen.getByLabelText("Reason for the reset"), {
      target: { value: `  ${REASON}  ` },
    });
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "RESET" } });

    fireEvent.click(confirmButton());

    await waitFor(() => expect(resetAction).toHaveBeenCalledWith(USER_ID, { reason: REASON }));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Two-step verification reset"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the failure and does not refresh when the reset is refused", async () => {
    resetAction.mockResolvedValue({
      ok: false,
      error: "Only a platform admin can reset a staff account",
    });
    renderAs("support_concierge", <UserTwoFactorResetAction userId={USER_ID} />);
    openDialog();
    fireEvent.change(screen.getByLabelText("Reason for the reset"), { target: { value: REASON } });
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: "RESET" } });

    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith("Only a platform admin can reset a staff account"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
