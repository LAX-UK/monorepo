import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type PersonActionAccess,
  type PersonActionTarget,
  usePersonActions,
} from "./use-person-actions";

const refresh = vi.fn();
const suspendAction = vi.fn();
const unsuspendAction = vi.fn();
const resetAction = vi.fn();
const roleAction = vi.fn();
const cancelEmailAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminSuspendUserResultAction: (...args: unknown[]) => suspendAction(...args),
  adminUnsuspendUserResultAction: (...args: unknown[]) => unsuspendAction(...args),
  adminResetTwoFactorResultAction: (...args: unknown[]) => resetAction(...args),
  adminSetUserRoleResultAction: (...args: unknown[]) => roleAction(...args),
  adminCancelEmailChangeResultAction: (...args: unknown[]) => cancelEmailAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
  recentReauthAttempt: () => false,
}));

const FULL: PersonActionAccess = { canModerate: true, canManageRoles: true };

const ada: PersonActionTarget = {
  id: "user_1",
  name: "Ada Lovelace",
  role: "client",
  staffRole: null,
  suspended: false,
  twoFactorEnabled: false,
};

function Harness({
  target,
  access = FULL,
}: { target: PersonActionTarget; access?: PersonActionAccess }) {
  const actions = usePersonActions(access);
  return (
    <>
      <ul>
        {actions.actionsFor(target).map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={Boolean(action.disabledReason)}
              title={action.disabledReason}
              onClick={() => action.onSelect?.()}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      {actions.dialogs}
    </>
  );
}

describe("usePersonActions", () => {
  beforeEach(() => {
    for (const fn of [
      refresh,
      suspendAction,
      unsuspendAction,
      resetAction,
      roleAction,
      cancelEmailAction,
    ]) {
      fn.mockReset();
    }
    notifySuccess.mockReset();
  });

  it("offers nothing to a role that can neither moderate nor manage roles", () => {
    render(<Harness target={ada} access={{ canModerate: false, canManageRoles: false }} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  describe("change email address", () => {
    const withEmail: PersonActionTarget = {
      ...ada,
      email: "ada@example.com",
      kycStatus: "approved",
    };
    const support = { canChange: true, canChangeStaff: false, viewerId: "viewer_1" };

    it("is left out where the email change is not offered", () => {
      render(<Harness target={withEmail} />);
      expect(screen.queryByRole("button", { name: "Change email address" })).toBeNull();
    });

    it("is left out for a role that cannot change emails", () => {
      const none = { canChange: false, canChangeStaff: false, viewerId: "viewer_1" };
      render(<Harness target={withEmail} access={{ ...FULL, emailChange: none }} />);
      expect(screen.queryByRole("button", { name: "Change email address" })).toBeNull();
    });

    it("is offered to a role that can", () => {
      render(<Harness target={withEmail} access={{ ...FULL, emailChange: support }} />);
      expect(screen.getByRole("button", { name: "Change email address" })).toBeEnabled();
    });

    it("says why a staff account cannot be moved by this role", () => {
      render(
        <Harness
          target={{ ...withEmail, role: "staff" }}
          access={{ ...FULL, emailChange: support }}
        />,
      );
      expect(screen.getByRole("button", { name: "Change email address" })).toHaveAttribute(
        "title",
        "Only an Administrator can change a staff member's email",
      );
    });

    it("opens the dialog for the person", () => {
      render(<Harness target={withEmail} access={{ ...FULL, emailChange: support }} />);
      fireEvent.click(screen.getByRole("button", { name: "Change email address" }));
      expect(
        screen.getByRole("dialog", { name: "Change Ada Lovelace's email address" }),
      ).toBeInTheDocument();
    });
  });

  describe("cancel email change", () => {
    const withEmail: PersonActionTarget = {
      ...ada,
      email: "ada@example.com",
      kycStatus: "approved",
    };
    const support = { canChange: true, canChangeStaff: false, viewerId: "viewer_1" };
    const asSupport = { ...FULL, emailChange: support };

    it("is offered with the email change, and left out without it", () => {
      render(<Harness target={withEmail} access={asSupport} />);
      expect(screen.getByRole("button", { name: "Cancel email change" })).toBeEnabled();
    });

    it("is left out where the email change is not offered or the role cannot use it", () => {
      const none = { canChange: false, canChangeStaff: false, viewerId: "viewer_1" };
      const { unmount } = render(<Harness target={withEmail} />);
      expect(screen.queryByRole("button", { name: "Cancel email change" })).toBeNull();
      unmount();
      render(<Harness target={withEmail} access={{ ...FULL, emailChange: none }} />);
      expect(screen.queryByRole("button", { name: "Cancel email change" })).toBeNull();
    });

    it("says why it is unavailable for your own account or a staff member", () => {
      const { unmount } = render(
        <Harness target={{ ...withEmail, id: "viewer_1" }} access={asSupport} />,
      );
      expect(screen.getByRole("button", { name: "Cancel email change" })).toHaveAttribute(
        "title",
        "Change your own address from LAX Account",
      );
      unmount();
      render(<Harness target={{ ...withEmail, role: "staff" }} access={asSupport} />);
      expect(screen.getByRole("button", { name: "Cancel email change" })).toHaveAttribute(
        "title",
        "Only an Administrator can change a staff member's email",
      );
    });

    it("asks for a reason, starting on Keep it, and cancels with it", async () => {
      cancelEmailAction.mockResolvedValue({ ok: true });
      render(<Harness target={withEmail} access={asSupport} />);
      fireEvent.click(screen.getByRole("button", { name: "Cancel email change" }));

      const dialog = await screen.findByRole("dialog", {
        name: "Cancel Ada Lovelace's email change?",
      });
      expect(dialog).toHaveTextContent("The link already emailed to the new address stops working");
      await waitFor(() => expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus());

      const confirm = screen.getAllByRole("button", { name: "Cancel email change" }).at(-1);
      if (!confirm) throw new Error("no confirm button");
      fireEvent.click(confirm);
      expect(await screen.findByText("Enter a reason of at least 10 characters.")).toBeVisible();
      expect(cancelEmailAction).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
        target: { value: "Caller found the old mailbox again." },
      });
      fireEvent.click(confirm);
      await waitFor(() =>
        expect(cancelEmailAction).toHaveBeenCalledWith("user_1", {
          reason: "Caller found the old mailbox again.",
        }),
      );
      await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Email change cancelled"));
    });

    it("keeps the dialog open with the reason when nothing is waiting", async () => {
      cancelEmailAction.mockResolvedValue({
        ok: false,
        error: "No email change is waiting for this person. It may already be done.",
        status: 409,
      });
      render(<Harness target={withEmail} access={asSupport} />);
      fireEvent.click(screen.getByRole("button", { name: "Cancel email change" }));
      await screen.findByRole("dialog", { name: "Cancel Ada Lovelace's email change?" });
      fireEvent.change(screen.getByLabelText("Reason for cancelling"), {
        target: { value: "Caller found the old mailbox again." },
      });
      const confirm = screen.getAllByRole("button", { name: "Cancel email change" }).at(-1);
      if (!confirm) throw new Error("no confirm button");
      fireEvent.click(confirm);
      expect(await screen.findByText(/No email change is waiting for this person/)).toBeVisible();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByLabelText("Reason for cancelling")).toHaveValue(
        "Caller found the old mailbox again.",
      );
      expect(notifySuccess).not.toHaveBeenCalled();
    });
  });

  it("explains why the two-step reset is unavailable", () => {
    render(<Harness target={ada} />);
    expect(screen.getByRole("button", { name: "Reset two-step verification" })).toHaveAttribute(
      "title",
      "Two-step verification is not turned on",
    );
  });

  it("suspends with an audited reason, starting on Cancel", async () => {
    suspendAction.mockResolvedValue({ ok: true });
    render(<Harness target={ada} />);
    fireEvent.click(screen.getByRole("button", { name: "Suspend account" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    const confirm = screen.getAllByRole("button", { name: "Suspend account" }).at(-1);
    if (!confirm) throw new Error("no confirm button");
    fireEvent.click(confirm);
    expect(await screen.findByText("Enter a reason of at least 10 characters.")).toBeVisible();
    expect(suspendAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason for suspending"), {
      target: { value: "Chargeback fraud on two lots" },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(suspendAction).toHaveBeenCalledWith("user_1", {
        reason: "Chargeback fraud on two lots",
      }),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Ada Lovelace suspended"));
  });

  it("changes a client's role in a dialog that keeps a failure in view", async () => {
    roleAction.mockResolvedValue({ ok: false, error: "You cannot change your own role." });
    render(<Harness target={ada} />);
    fireEvent.click(screen.getByRole("button", { name: "Change role" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Change Ada Lovelace's role");
    fireEvent.click(screen.getByRole("button", { name: "Save role" }));
    await waitFor(() =>
      expect(roleAction).toHaveBeenCalledWith("user_1", { role: "client", staffRole: null }),
    );
    expect(await screen.findByText("You cannot change your own role.")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends a staff member's role changes to their record, where each role is managed", () => {
    const actions: { id: string; href?: string }[] = [];
    function Probe() {
      const person = usePersonActions(FULL);
      actions.push(...person.actionsFor({ ...ada, role: "staff", staffRole: "finance" }));
      return null;
    }
    render(<Probe />);
    expect(actions.find((action) => action.id === "role")).toMatchObject({
      label: "Manage roles",
      href: "/admin/staff/user_1#roles",
    });
  });
});
