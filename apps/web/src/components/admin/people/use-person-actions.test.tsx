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
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminSuspendUserResultAction: (...args: unknown[]) => suspendAction(...args),
  adminUnsuspendUserResultAction: (...args: unknown[]) => unsuspendAction(...args),
  adminResetTwoFactorResultAction: (...args: unknown[]) => resetAction(...args),
  adminSetUserRoleResultAction: (...args: unknown[]) => roleAction(...args),
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
    for (const fn of [refresh, suspendAction, unsuspendAction, resetAction, roleAction]) {
      fn.mockReset();
    }
    notifySuccess.mockReset();
  });

  it("offers nothing to a role that can neither moderate nor manage roles", () => {
    render(<Harness target={ada} access={{ canModerate: false, canManageRoles: false }} />);
    expect(screen.queryByRole("button")).toBeNull();
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
