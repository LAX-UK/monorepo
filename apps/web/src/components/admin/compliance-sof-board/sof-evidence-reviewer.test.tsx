import {
  readSofReviewNote,
  stashSofReviewNote,
} from "@/lib/admin/compliance/sof-review-note-draft";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SofEvidenceReviewer } from "./sof-evidence-reviewer";

const refresh = vi.fn();
const review = vi.fn();
const stepUp = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/actions/compliance", () => ({
  reviewSofDocumentAction: (...args: unknown[]) => review(...args),
  downloadSofDocumentAction: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.client", () => ({
  isStaffStepUpRequired: (f: { errorCode?: string }) => f?.errorCode === "step_up_required",
  handleStaffStepUp: (f: unknown) => stepUp(f),
}));

const DOC = {
  id: "doc-1",
  requestedType: "Bank statement",
  fileName: "statement.pdf",
  label: null,
  uploadedAt: "2026-01-01T00:00:00.000Z",
  staffReview: null,
};
const detail = {
  submittedDocuments: [DOC],
  documentRequest: { requestedAt: null },
} as never;
const row = { status: "pending", declaredSource: null } as never;

const NOTE_KEY = "sof-review-note:doc-1";
const DOC_ID = "doc-1";
const notes = () => screen.getByRole("textbox") as HTMLTextAreaElement;

describe("SofEvidenceReviewer and a stale sign-in", () => {
  beforeEach(() => {
    for (const fn of [refresh, review, stepUp]) fn.mockReset();
    window.sessionStorage.clear();
  });

  it("parks the notes, then sends the reviewer to sign in again", async () => {
    review.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    stepUp.mockReturnValue(true);
    render(<SofEvidenceReviewer caseId="c1" row={row} detail={detail} />);
    fireEvent.change(notes(), { target: { value: "Statement matches the declared source." } });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));

    await waitFor(() => expect(stepUp).toHaveBeenCalled());
    expect(readSofReviewNote(DOC_ID)).toBe("Statement matches the declared source.");
    expect(screen.queryByText("The review was not saved")).toBeNull();
  });

  it("puts the parked notes back after the round trip", async () => {
    stashSofReviewNote(DOC_ID, "Statement matches the declared source.");
    render(<SofEvidenceReviewer caseId="c1" row={row} detail={detail} />);
    await waitFor(() => expect(notes().value).toBe("Statement matches the declared source."));
  });

  it("clears the parked notes once the review is saved", async () => {
    stashSofReviewNote(DOC_ID, "Statement matches the declared source.");
    review.mockResolvedValue({ ok: true });
    render(<SofEvidenceReviewer caseId="c1" row={row} detail={detail} />);
    await waitFor(() => expect(notes().value).not.toBe(""));
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(window.sessionStorage.getItem(NOTE_KEY)).toBeNull();
  });

  it("shows an ordinary failure and keeps nothing parked", async () => {
    review.mockResolvedValue({ ok: false, error: "Review save failed" });
    stepUp.mockReturnValue(false);
    render(<SofEvidenceReviewer caseId="c1" row={row} detail={detail} />);
    fireEvent.change(notes(), { target: { value: "n" } });
    fireEvent.click(screen.getByRole("button", { name: "Save review" }));
    expect(await screen.findByText("Review save failed")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(NOTE_KEY)).toBeNull();
  });
});
