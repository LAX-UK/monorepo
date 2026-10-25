import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type SubmissionActionTarget, useSubmissionActions } from "./use-submission-actions";

const refresh = vi.fn();
const startReview = vi.fn();
const accept = vi.fn();
const reject = vi.fn();
const assign = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin-submissions", () => ({
  adminStartSubmissionReviewResultAction: (...args: unknown[]) => startReview(...args),
  adminAcceptSubmissionResultAction: (...args: unknown[]) => accept(...args),
  adminRejectSubmissionResultAction: (...args: unknown[]) => reject(...args),
  adminAssignSubmissionResultAction: (...args: unknown[]) => assign(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const submission: SubmissionActionTarget = {
  id: "sub_1",
  title: "Harbour at dusk",
  status: "under_review",
  blocksAccept: false,
  assignedToMe: false,
  decisionHref: "/admin/submissions/sub_1/decision",
};

function Harness({ target }: { target: SubmissionActionTarget }) {
  const actions = useSubmissionActions({ currentUserId: "user_1" });
  return (
    <>
      {actions.actionsFor(target).map((action) =>
        action.href ? (
          <a key={action.id} href={action.href}>
            {action.label}
          </a>
        ) : (
          <button
            key={action.id}
            type="button"
            disabled={Boolean(action.disabledReason)}
            onClick={() => action.onSelect?.()}
          >
            {action.label}
          </button>
        ),
      )}
      {actions.dialogs}
    </>
  );
}

describe("useSubmissionActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, startReview, accept, reject, assign, notifySuccess]) fn.mockReset();
  });

  it("starts the review of a new submission at once", async () => {
    startReview.mockResolvedValue({ ok: true });
    render(<Harness target={{ ...submission, status: "submitted" }} />);
    expect(screen.queryByRole("button", { name: "Accept for cataloguing" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() => expect(startReview).toHaveBeenCalledWith("sub_1"));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Harbour at dusk is under review"),
    );
  });

  it("accepts only after confirming", async () => {
    accept.mockResolvedValue({ ok: true });
    render(<Harness target={submission} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept for cataloguing" }));
    expect(accept).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accept submission" }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith("sub_1", {}));
  });

  it("blocks accepting a submission with required details missing", () => {
    render(<Harness target={{ ...submission, blocksAccept: true }} />);
    expect(screen.getByRole("button", { name: "Accept for cataloguing" })).toBeDisabled();
  });

  it("rejects with the reason for the seller", async () => {
    reject.mockResolvedValue({ ok: true });
    render(<Harness target={submission} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject…" }));
    fireEvent.change(screen.getByLabelText(/Reason for the seller/), {
      target: { value: "Outside the scope of our sales." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject submission" }));
    await waitFor(() =>
      expect(reject).toHaveBeenCalledWith("sub_1", {
        rejectionReason: "Outside the scope of our sales.",
      }),
    );
  });

  it("assigns to the current person, and links an accepted one to its decision page", async () => {
    assign.mockResolvedValue({ ok: true });
    const { unmount } = render(<Harness target={submission} />);
    fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("sub_1", "user_1"));
    unmount();
    render(<Harness target={{ ...submission, status: "approved" }} />);
    expect(screen.getByRole("link", { name: "Create lot" })).toHaveAttribute(
      "href",
      "/admin/submissions/sub_1/decision",
    );
  });
});
