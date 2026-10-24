import type { SofStaffRow } from "@/lib/admin/compliance/sof-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSofReopenAction } from "./sof-reopen-action";

const refresh = vi.fn();
const reopenAction = vi.fn();
const notifySuccess = vi.fn();

// Radix's dialog portals, traps focus and animates, which is slow and noisy in jsdom. This
// stand-in keeps the open/close contract so the tests cover what the dialog asks and does.
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/compliance", () => ({
  sofReopenAction: (...args: unknown[]) => reopenAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const rejected: SofStaffRow = {
  id: "case_1",
  userId: "user_1",
  buyer: "Ada Lovelace",
  settlement: null,
  otherOpenCases: 0,
  status: { label: "Rejected", tone: "danger" },
  trigger: "Single transaction over the threshold",
  exposure: "£185,001.25",
  exposurePence: 18_500_125,
  evidenceCount: 2,
  triage: "Recommended reject",
  createdAt: "2026-10-20T10:00:00.000Z",
  reviewedAt: "2026-10-22T10:00:00.000Z",
  href: "/admin/compliance/source-of-funds/case_1?listStatus=rejected",
  canReopen: true,
};

function Harness({ row, canReopen = true }: { row: SofStaffRow; canReopen?: boolean }) {
  const reopen = useSofReopenAction({ canReopen });
  return (
    <>
      <ul>
        {reopen.actionsFor(row).map((action) => (
          <li key={action.id}>
            <button type="button" onClick={() => action.onSelect?.()}>
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      {reopen.dialogs}
    </>
  );
}

describe("useSofReopenAction", () => {
  beforeEach(() => {
    for (const fn of [refresh, reopenAction, notifySuccess]) fn.mockReset();
  });

  it("offers reopening to an MLRO, for a rejected case only", () => {
    const { unmount } = render(<Harness row={rejected} />);
    expect(screen.getByRole("button", { name: "Reopen for review" })).toBeInTheDocument();
    unmount();
    render(<Harness row={{ ...rejected, canReopen: false }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers nothing to a role that cannot decide", () => {
    render(<Harness row={rejected} canReopen={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("confirms with the buyer and the exposure before reopening", async () => {
    reopenAction.mockResolvedValue({ ok: true });
    render(<Harness row={rejected} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen for review" }));

    expect(
      screen.getByRole("heading", { name: "Reopen the rejected case for Ada Lovelace?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("£185,001.25")).toBeInTheDocument();
    expect(reopenAction).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Reopen for review" }).at(-1) as HTMLElement,
    );
    await waitFor(() => expect(reopenAction).toHaveBeenCalledWith({ caseId: "case_1" }));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Reopened the case for Ada Lovelace"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the dialog open and says why when the reopen fails", async () => {
    reopenAction.mockResolvedValue({ ok: false, error: "Only rejected cases can be reopened." });
    render(<Harness row={rejected} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen for review" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Reopen for review" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByText("Only rejected cases can be reopened.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Reopen the rejected case for Ada Lovelace?" }),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in when the API requires one", async () => {
    reopenAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    render(<Harness row={rejected} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen for review" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Reopen for review" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeInTheDocument();
  });
});
