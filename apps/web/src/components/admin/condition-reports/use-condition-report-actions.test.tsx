import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ConditionReportActionTarget,
  useConditionReportActions,
} from "./use-condition-report-actions";

const refresh = vi.fn();
const declineAction = vi.fn();
const progressAction = vi.fn();
const notifySuccess = vi.fn();
const openPanel = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin", () => ({
  adminDeclineConditionReportResultAction: (...args: unknown[]) => declineAction(...args),
  adminMarkConditionReportInProgressResultAction: (...args: unknown[]) => progressAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const request: ConditionReportActionTarget = {
  id: "req_1",
  lotTitle: "Blue Interior",
  status: "pending",
};

function Harness({ target }: { target: ConditionReportActionTarget }) {
  const actions = useConditionReportActions({ openPanel });
  return (
    <>
      {actions.actionsFor(target).map((action) => (
        <button key={action.id} type="button" onClick={() => action.onSelect?.()}>
          {action.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

describe("useConditionReportActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, declineAction, progressAction, notifySuccess, openPanel]) {
      fn.mockReset();
    }
  });

  it("offers nothing once a request is closed", () => {
    const { rerender } = render(<Harness target={{ ...request, status: "fulfilled" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<Harness target={{ ...request, status: "declined" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the panel to fulfil, since fulfilling is a form", () => {
    render(<Harness target={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Fulfil and publish…" }));
    expect(openPanel).toHaveBeenCalledWith("req_1");
  });

  it("offers in progress only for a request nobody has picked up", () => {
    const { rerender } = render(<Harness target={request} />);
    expect(screen.getByRole("button", { name: "Mark in progress" })).toBeInTheDocument();
    rerender(<Harness target={{ ...request, status: "in_progress" }} />);
    expect(screen.queryByRole("button", { name: "Mark in progress" })).not.toBeInTheDocument();
  });

  it("marks a request in progress only after confirming, then refreshes", async () => {
    progressAction.mockResolvedValue({ ok: true });
    render(<Harness target={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark in progress" }));
    expect(progressAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mark in progress" }));
    await waitFor(() => expect(progressAction).toHaveBeenCalledWith("req_1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("declines only with a reason, and keeps the request as the way out", async () => {
    declineAction.mockResolvedValue({ ok: true });
    render(<Harness target={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Decline request…" }));
    expect(screen.getByRole("button", { name: "Keep request" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Decline request" }));
    expect(declineAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Reason for declining"), {
      target: { value: "Lot has been withdrawn" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decline request" }));
    await waitFor(() =>
      expect(declineAction).toHaveBeenCalledWith("req_1", "Lot has been withdrawn"),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Request declined"));
  });

  it("keeps a failed decline in the dialog with what was typed", async () => {
    declineAction.mockResolvedValue({ ok: false, error: "The request is already closed" });
    render(<Harness target={request} />);
    fireEvent.click(screen.getByRole("button", { name: "Decline request…" }));
    fireEvent.change(screen.getByLabelText("Reason for declining"), {
      target: { value: "Not available" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decline request" }));
    expect(await screen.findByText("The request is already closed")).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for declining")).toHaveValue("Not available");
  });
});
