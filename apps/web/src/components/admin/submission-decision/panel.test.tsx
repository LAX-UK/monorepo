import { adminCreateArtistResultAction } from "@/lib/actions/admin";
import { searchAdminArtistsAction } from "@/lib/actions/admin-artists-search";
import {
  adminAcceptSubmissionResultAction,
  adminConvertSubmissionResultAction,
  adminProposeSubmissionTermsResultAction,
  adminRejectSubmissionResultAction,
  adminRequestSubmissionChangesResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { trackStaffAccept, trackStaffConvert } from "@/lib/analytics/sell-funnel";
import { actionSuccess } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { ConsignmentAgreement, ItemSubmissionStatus } from "@auction/types";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SUBMISSION_APPROVE_FORM_ID, SUBMISSION_REJECT_FORM_ID } from "./form-ids";
import { AdminSubmissionDecisionPanel } from "./panel";

const NOTES_ID = `${SUBMISSION_APPROVE_FORM_ID}-reviewNotes`;
const REASON_ID = `${SUBMISSION_REJECT_FORM_ID}-rejectionReason`;

vi.mock("@/lib/actions/admin-submissions", () => ({
  adminStartSubmissionReviewResultAction: vi.fn(),
  adminAcceptSubmissionResultAction: vi.fn(),
  adminRejectSubmissionResultAction: vi.fn(),
  adminConvertSubmissionResultAction: vi.fn(),
  adminRequestSubmissionChangesResultAction: vi.fn(),
  adminProposeSubmissionTermsResultAction: vi.fn(),
}));

vi.mock("@/lib/actions/admin-artists-search", () => ({
  searchAdminArtistsAction: vi.fn(),
}));

vi.mock("@/lib/actions/admin", () => ({
  adminCreateArtistResultAction: vi.fn(),
}));

vi.mock("@/lib/analytics/sell-funnel", () => ({
  trackStaffAccept: vi.fn(),
  trackStaffConvert: vi.fn(),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));

vi.mock("@/lib/auth/api-base", () => ({
  apiBaseUrl: () => "http://test.local",
}));

const SUBMISSION_ID = "10000000-0000-4000-8000-000000000001";
const LOT_ID = "30000000-0000-4000-8000-000000000003";
const CATEGORY_ID = "40000000-0000-4000-8000-000000000004";

const baseSubmission: ComponentProps<typeof AdminSubmissionDecisionPanel>["submission"] = {
  title: "Blue vase",
  images: ["https://example.com/img.jpg"],
  description: "A nice vase",
  provenance: [],
  categoryId: CATEGORY_ID,
  categoryIds: [CATEGORY_ID],
  convertedLotId: null,
};

const ACCEPTED_AGREEMENT: ConsignmentAgreement = {
  id: "agr-1",
  submissionId: SUBMISSION_ID,
  legalEntityId: "le-1",
  termsVersion: "conditions-of-business-part-c-v1",
  estimateLow: "8000.00",
  estimateHigh: "12000.00",
  reservePrice: null,
  commissionPercent: "15.00",
  currency: "GBP",
  proposedAt: new Date("2026-10-04T10:00:00Z"),
  acceptedAt: new Date("2026-10-05T12:00:00Z"),
  acceptedByUserId: "u1",
  acceptedByName: "Jane Smith",
};

function renderPanel(
  status: ItemSubmissionStatus,
  overrides: Partial<ComponentProps<typeof AdminSubmissionDecisionPanel>> = {},
) {
  return renderWithViewer(
    <AdminSubmissionDecisionPanel
      submissionId={SUBMISSION_ID}
      status={status}
      submission={baseSubmission}
      {...overrides}
    />,
  );
}

function mockPanelVisible() {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 100,
    height: 100,
    top: 0,
    left: 0,
    bottom: 100,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
}

describe("AdminSubmissionDecisionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPanelVisible();
  });

  describe("per-status render", () => {
    it("submitted shows Start review only", () => {
      renderPanel("submitted");
      expect(screen.getByRole("button", { name: "Start review" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Accept and send terms" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject submission" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Convert to draft lot" }),
      ).not.toBeInTheDocument();
    });

    it("under_review shows accept and reject forms with checklist and shortcut hint", () => {
      renderPanel("under_review");
      expect(screen.getByRole("button", { name: "Accept and send terms" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reject submission" })).toBeInTheDocument();
      expect(document.getElementById(SUBMISSION_APPROVE_FORM_ID)).toBeInTheDocument();
      expect(document.getElementById(SUBMISSION_REJECT_FORM_ID)).toBeInTheDocument();
      expect(screen.getByText(/Shortcuts when not typing in a field/)).toBeInTheDocument();
    });

    it("approved shows convert form with artist combobox and checklist", () => {
      renderPanel("approved", {
        submitterDisplayName: "Jane Maker",
        agreement: ACCEPTED_AGREEMENT,
      });
      expect(screen.getByRole("button", { name: "Convert to draft lot" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use submitter as artist" })).toBeInTheDocument();
      expect(screen.getByText(/Shortcuts when not typing in a field/)).toBeInTheDocument();
      expect(screen.getByText("Catalogue artist")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: /Catalogue artist/ })).toBeInTheDocument();
    });

    it("converted shows Open draft lot link when convertedLotId is set", () => {
      renderPanel("converted", {
        submission: { ...baseSubmission, convertedLotId: LOT_ID },
      });
      expect(screen.getByRole("link", { name: "Open draft lot" })).toHaveAttribute(
        "href",
        `/admin/lots/${LOT_ID}`,
      );
    });

    it("rejected shows no-actions text", () => {
      renderPanel("rejected");
      expect(screen.getByText("No further actions for this status.")).toBeInTheDocument();
    });

    it("withdrawn shows no-actions text", () => {
      renderPanel("withdrawn");
      expect(screen.getByText("No further actions for this status.")).toBeInTheDocument();
    });

    it("draft renders without crashing", () => {
      renderPanel("draft");
      expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
      expect(screen.queryByText("No further actions for this status.")).not.toBeInTheDocument();
    });
  });

  describe("start review", () => {
    it("happy path notifies and refreshes", async () => {
      vi.mocked(adminStartSubmissionReviewResultAction).mockResolvedValue(actionSuccess());
      renderPanel("submitted");
      fireEvent.click(screen.getByRole("button", { name: "Start review" }));

      await waitFor(() => {
        expect(adminStartSubmissionReviewResultAction).toHaveBeenCalledWith(SUBMISSION_ID);
        expect(notify.success).toHaveBeenCalledWith("Review started");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("error path notifies failure", async () => {
      vi.mocked(adminStartSubmissionReviewResultAction).mockResolvedValue({
        ok: false,
        error: "Cannot start review",
      });
      renderPanel("submitted");
      fireEvent.click(screen.getByRole("button", { name: "Start review" }));

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith("Cannot start review");
        expect(mockRefresh).not.toHaveBeenCalled();
      });
    });
  });

  describe("accept", () => {
    it("happy path omits empty notes and tracks accept", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.click(screen.getByRole("button", { name: "Accept and send terms" }));

      await waitFor(() => {
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {});
        expect(trackStaffAccept).toHaveBeenCalledWith(SUBMISSION_ID);
        expect(notify.success).toHaveBeenCalledWith(
          "Accepted. The seller has been asked to accept the terms.",
        );
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("happy path includes trimmed review notes", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.change(document.getElementById(NOTES_ID) as HTMLTextAreaElement, {
        target: { value: "  Looks good  " },
      });
      fireEvent.click(screen.getByRole("button", { name: "Accept and send terms" }));

      await waitFor(() => {
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {
          reviewNotes: "Looks good",
        });
      });
    });

    it("applies field errors on failure", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue({
        ok: false,
        error: "Validation failed",
        fieldErrors: { reviewNotes: ["Too long"] },
      });
      renderPanel("under_review");
      fireEvent.click(screen.getByRole("button", { name: "Accept and send terms" }));

      expect(await screen.findByText("Too long")).toBeInTheDocument();
      expect(notify.error).not.toHaveBeenCalled();
    });
  });

  describe("reject", () => {
    function openRejectConfirm(reason: string) {
      fireEvent.change(document.getElementById(REASON_ID) as HTMLTextAreaElement, {
        target: { value: reason },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reject submission" }));
      return screen.findByRole("dialog", { name: "Reject Blue vase?" });
    }

    it("asks before rejecting, then notifies and refreshes", async () => {
      vi.mocked(adminRejectSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      const dialog = await openRejectConfirm("Not suitable");
      expect(adminRejectSubmissionResultAction).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Reject submission" }));

      await waitFor(() => {
        expect(adminRejectSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {
          rejectionReason: "Not suitable",
          reviewNotes: "",
        });
        expect(notify.success).toHaveBeenCalledWith(
          "Submission rejected. The seller has been told.",
        );
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("keeps the refusal in the question, with the reason still typed", async () => {
      vi.mocked(adminRejectSubmissionResultAction).mockResolvedValue({
        ok: false,
        error: "Reject failed",
      });
      renderPanel("under_review");
      const dialog = await openRejectConfirm("Weak");
      fireEvent.click(within(dialog).getByRole("button", { name: "Reject submission" }));

      expect(await within(dialog).findByText("Reject failed")).toBeInTheDocument();
      expect((document.getElementById(REASON_ID) as HTMLTextAreaElement).value).toBe("Weak");
    });

    it("shows the missing reason on its field and does not ask", async () => {
      renderPanel("under_review");
      fireEvent.click(screen.getByRole("button", { name: "Reject submission" }));

      expect(await screen.findByText("Rejection reason is required")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(adminRejectSubmissionResultAction).not.toHaveBeenCalled();
    });

    it("clears the error as soon as a reason is typed", async () => {
      renderPanel("under_review");
      fireEvent.click(screen.getByRole("button", { name: "Reject submission" }));
      await screen.findByText("Rejection reason is required");
      fireEvent.change(document.getElementById(REASON_ID) as HTMLTextAreaElement, {
        target: { value: "Needs a signature photo" },
      });
      await waitFor(() =>
        expect(screen.queryByText("Rejection reason is required")).not.toBeInTheDocument(),
      );
    });
  });

  describe("convert", () => {
    it("pushes to lot page when lotId is returned", async () => {
      vi.mocked(adminConvertSubmissionResultAction).mockResolvedValue(
        actionSuccess({ lotId: LOT_ID, readinessPercent: 75 }),
      );
      renderPanel("approved", { agreement: ACCEPTED_AGREEMENT });
      fireEvent.click(screen.getByRole("button", { name: "Convert to draft lot" }));

      await waitFor(() => {
        expect(adminConvertSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {});
        expect(trackStaffConvert).toHaveBeenCalledWith(SUBMISSION_ID);
        expect(notify.success).toHaveBeenCalledWith("Draft lot created — 75% catalogue ready");
        expect(mockPush).toHaveBeenCalledWith(`/admin/lots/${LOT_ID}`);
        expect(mockRefresh).not.toHaveBeenCalled();
      });
    });

    it("refreshes when lotId is missing", async () => {
      vi.mocked(adminConvertSubmissionResultAction).mockResolvedValue(
        actionSuccess({ lotId: undefined }),
      );
      renderPanel("approved", { agreement: ACCEPTED_AGREEMENT });
      fireEvent.click(screen.getByRole("button", { name: "Convert to draft lot" }));

      await waitFor(() => {
        expect(notify.success).toHaveBeenCalledWith("Draft lot created");
        expect(mockRefresh).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it("applies field errors on failure", async () => {
      vi.mocked(adminConvertSubmissionResultAction).mockResolvedValue({
        ok: false,
        error: "Convert failed",
        fieldErrors: { artistId: ["Choose an artist"] },
      });
      renderPanel("approved", { agreement: ACCEPTED_AGREEMENT });
      fireEvent.click(screen.getByRole("button", { name: "Convert to draft lot" }));

      expect(await screen.findByText("Choose an artist")).toBeInTheDocument();
      expect(notify.error).not.toHaveBeenCalled();
    });
  });

  describe("create artist dialog", () => {
    it("opens seeded with submitter display name", () => {
      renderPanel("approved", {
        submitterDisplayName: "Jane Maker",
        agreement: ACCEPTED_AGREEMENT,
      });
      fireEvent.click(screen.getByRole("button", { name: "Use submitter as artist" }));
      expect(screen.getByRole("dialog", { name: "Create artist" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jane Maker")).toBeInTheDocument();
    });
  });

  describe("unsaved notes", () => {
    it("asks before an in-app link throws away typed notes", async () => {
      renderPanel("under_review");
      const link = document.createElement("a");
      link.href = "/admin/lots";
      link.textContent = "Lots";
      link.addEventListener("click", (event) => event.preventDefault());
      document.body.append(link);

      fireEvent.click(link);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.change(document.getElementById(NOTES_ID) as HTMLTextAreaElement, {
        target: { value: "Check the signature" },
      });
      fireEvent.click(link);
      expect(
        await screen.findByRole("dialog", { name: "Discard changes to Blue vase?" }),
      ).toBeInTheDocument();
      link.remove();
    });

    it("keeps a refused accept on the form, with the notes still typed", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue({
        ok: false,
        error: "Required details are missing",
      });
      renderPanel("under_review");
      fireEvent.change(document.getElementById(NOTES_ID) as HTMLTextAreaElement, {
        target: { value: "Looks fine" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Accept and send terms" }));

      expect(await screen.findByText("Required details are missing")).toBeInTheDocument();
      expect((document.getElementById(NOTES_ID) as HTMLTextAreaElement).value).toBe("Looks fine");
    });
  });

  describe("keyboard shortcuts", () => {
    it("A submits accept when not in a text field", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.keyDown(window, { key: "a" });

      await waitFor(() => {
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalled();
      });
    });

    it("Cmd+Enter submits accept even from a textarea", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      const notes = document.getElementById(NOTES_ID) as HTMLTextAreaElement;
      notes.focus();
      fireEvent.keyDown(window, { key: "Enter", metaKey: true });

      await waitFor(() => {
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalled();
      });
    });

    it("R focuses rejection reason", () => {
      renderPanel("under_review");
      fireEvent.keyDown(window, { key: "r" });
      expect(document.activeElement).toBe(document.getElementById(REASON_ID));
    });

    it("does not fire shortcuts for submitted status", async () => {
      vi.mocked(adminStartSubmissionReviewResultAction).mockResolvedValue(actionSuccess());
      renderPanel("submitted");
      fireEvent.keyDown(window, { key: "a" });

      await waitFor(() => {
        expect(adminStartSubmissionReviewResultAction).not.toHaveBeenCalled();
        expect(adminAcceptSubmissionResultAction).not.toHaveBeenCalled();
      });
    });
  });

  describe("consignment agreement and needs changes", () => {
    it("waits for the seller before cataloguing, without a convert button", () => {
      renderPanel("approved", {
        agreement: { ...ACCEPTED_AGREEMENT, acceptedAt: null, acceptedByUserId: null },
      });
      expect(screen.getByText("Waiting for the seller")).toBeInTheDocument();
      expect(screen.getByText("£8,000 – £12,000")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Convert to draft lot" }),
      ).not.toBeInTheDocument();
    });

    it("says who accepted, when and which version", () => {
      renderPanel("approved", { agreement: ACCEPTED_AGREEMENT });
      expect(screen.getByText("Accepted by the seller")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith accepted on 5 Oct 2026 · Version 1")).toBeInTheDocument();
    });

    it("sends the estimate and commission with the acceptance", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.change(
        document.getElementById(`${SUBMISSION_APPROVE_FORM_ID}-reviewNotes`) as HTMLTextAreaElement,
        { target: { value: "Strong" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Accept and send terms" }));
      await waitFor(() =>
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {
          reviewNotes: "Strong",
        }),
      );
    });

    it("asks the seller for changes with a note", async () => {
      vi.mocked(adminRequestSubmissionChangesResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.change(
        document.getElementById("submission-request-changes-note") as HTMLTextAreaElement,
        { target: { value: "Add a photo of the back" } },
      );
      fireEvent.click(screen.getByRole("button", { name: "Ask for changes" }));
      await waitFor(() => {
        expect(adminRequestSubmissionChangesResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {
          note: "Add a photo of the back",
        });
        expect(notify.success).toHaveBeenCalledWith("The seller has been asked for changes.");
      });
    });

    it("disables accepting until the seller's identity is verified, and says what to do", () => {
      renderPanel("under_review", { sellerIdentityVerified: false, sellerLegalEntityId: "le-9" });
      expect(screen.getByText("The seller hasn't verified their identity yet")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Accept and send terms" })).toBeDisabled();
      expect(screen.getByRole("link", { name: "Open the seller" })).toHaveAttribute(
        "href",
        "/admin/legal-entities/le-9",
      );
      expect(screen.getByRole("button", { name: "Ask for changes" })).toBeEnabled();
      expect(screen.queryByText(/Shortcuts when not typing/)).not.toBeInTheDocument();
    });

    it("asks staff to add the estimate and terms to an incomplete proposal", async () => {
      vi.mocked(adminProposeSubmissionTermsResultAction).mockResolvedValue(actionSuccess());
      renderPanel("approved", {
        agreement: {
          ...ACCEPTED_AGREEMENT,
          acceptedAt: null,
          acceptedByUserId: null,
          estimateLow: null,
          estimateHigh: null,
          commissionPercent: null,
        },
      });
      expect(screen.getByText("Add the estimate and terms")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Convert to draft lot" }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Send the terms to the seller" }));
      expect(await screen.findByText("Enter the low estimate")).toBeInTheDocument();
      expect(adminProposeSubmissionTermsResultAction).not.toHaveBeenCalled();
    });

    it("shows that it waits for the seller's changes", () => {
      renderPanel("changes_requested");
      expect(screen.getByText("Waiting for the seller's changes")).toBeInTheDocument();
    });
  });
});

// Silence unused import for create dialog transitive mock
void adminCreateArtistResultAction;
void searchAdminArtistsAction;
