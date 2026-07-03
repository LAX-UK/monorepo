import { adminCreateArtistResultAction } from "@/lib/actions/admin";
import { searchAdminArtistsAction } from "@/lib/actions/admin-artists-search";
import {
  adminAcceptSubmissionResultAction,
  adminConvertSubmissionResultAction,
  adminRejectSubmissionResultAction,
  adminStartSubmissionReviewResultAction,
} from "@/lib/actions/admin-submissions";
import { CATALOG_FORM_IDS } from "@/lib/admin/catalog-form-ids";
import { trackStaffAccept, trackStaffConvert } from "@/lib/analytics/sell-funnel";
import { actionSuccess } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { ItemSubmissionStatus } from "@auction/types";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminSubmissionDecisionPanel } from "./panel";

vi.mock("@/lib/actions/admin-submissions", () => ({
  adminStartSubmissionReviewResultAction: vi.fn(),
  adminAcceptSubmissionResultAction: vi.fn(),
  adminRejectSubmissionResultAction: vi.fn(),
  adminConvertSubmissionResultAction: vi.fn(),
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
        screen.queryByRole("button", { name: "Accept for cataloguing" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Convert to draft lot" }),
      ).not.toBeInTheDocument();
    });

    it("under_review shows accept and reject forms with checklist and shortcut hint", () => {
      renderPanel("under_review");
      expect(screen.getByRole("button", { name: "Accept for cataloguing" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
      expect(document.getElementById(CATALOG_FORM_IDS.submissionApprove)).toBeInTheDocument();
      expect(document.getElementById(CATALOG_FORM_IDS.submissionReject)).toBeInTheDocument();
      expect(screen.getByText(/Shortcuts when not typing in a field/)).toBeInTheDocument();
    });

    it("approved shows convert form with artist combobox and checklist", () => {
      renderPanel("approved", { submitterDisplayName: "Jane Maker" });
      expect(screen.getByRole("button", { name: "Convert to draft lot" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Use submitter as artist" })).toBeInTheDocument();
      expect(screen.getByText(/Shortcuts when not typing in a field/)).toBeInTheDocument();
      expect(screen.getByText("Catalogue artist")).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole("button", { name: "Accept for cataloguing" }));

      await waitFor(() => {
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {});
        expect(trackStaffAccept).toHaveBeenCalledWith(SUBMISSION_ID);
        expect(notify.success).toHaveBeenCalledWith("Accepted for cataloguing");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("happy path includes trimmed review notes", async () => {
      vi.mocked(adminAcceptSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.change(document.getElementById("reviewNotesApprove") as HTMLTextAreaElement, {
        target: { value: "  Looks good  " },
      });
      fireEvent.click(screen.getByRole("button", { name: "Accept for cataloguing" }));

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
      fireEvent.click(screen.getByRole("button", { name: "Accept for cataloguing" }));

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith("Validation failed");
        expect(screen.getByText("Too long")).toBeInTheDocument();
      });
    });
  });

  describe("reject", () => {
    it("happy path notifies and refreshes", async () => {
      vi.mocked(adminRejectSubmissionResultAction).mockResolvedValue(actionSuccess());
      renderPanel("under_review");
      fireEvent.change(document.getElementById("rejectionReason") as HTMLTextAreaElement, {
        target: { value: "Not suitable" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      await waitFor(() => {
        expect(adminRejectSubmissionResultAction).toHaveBeenCalledWith(SUBMISSION_ID, {
          rejectionReason: "Not suitable",
          reviewNotes: "",
        });
        expect(notify.success).toHaveBeenCalledWith("Submission rejected");
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("blocks empty rejection reason before action call", async () => {
      renderPanel("under_review");
      const rejectForm = document.getElementById(CATALOG_FORM_IDS.submissionReject);
      expect(rejectForm).toBeTruthy();
      fireEvent.submit(rejectForm as HTMLFormElement);

      await waitFor(() => {
        expect(adminRejectSubmissionResultAction).not.toHaveBeenCalled();
      });
      expect(await screen.findByText("Rejection reason is required")).toBeInTheDocument();
    });

    it("applies field errors on failure", async () => {
      vi.mocked(adminRejectSubmissionResultAction).mockResolvedValue({
        ok: false,
        error: "Reject failed",
        fieldErrors: { rejectionReason: ["Be more specific"] },
      });
      renderPanel("under_review");
      fireEvent.change(document.getElementById("rejectionReason") as HTMLTextAreaElement, {
        target: { value: "Weak" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith("Reject failed");
        expect(screen.getByText("Be more specific")).toBeInTheDocument();
      });
    });
  });

  describe("convert", () => {
    it("pushes to lot page when lotId is returned", async () => {
      vi.mocked(adminConvertSubmissionResultAction).mockResolvedValue(
        actionSuccess({ lotId: LOT_ID, readinessPercent: 75 }),
      );
      renderPanel("approved");
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
      renderPanel("approved");
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
      renderPanel("approved");
      fireEvent.click(screen.getByRole("button", { name: "Convert to draft lot" }));

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith("Convert failed");
        expect(screen.getByText("Choose an artist")).toBeInTheDocument();
      });
    });
  });

  describe("create artist dialog", () => {
    it("opens seeded with submitter display name", () => {
      renderPanel("approved", { submitterDisplayName: "Jane Maker" });
      fireEvent.click(screen.getByRole("button", { name: "Use submitter as artist" }));
      expect(screen.getByRole("dialog", { name: "Create artist" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jane Maker")).toBeInTheDocument();
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
      const notes = document.getElementById("reviewNotesApprove") as HTMLTextAreaElement;
      notes.focus();
      fireEvent.keyDown(window, { key: "Enter", metaKey: true });

      await waitFor(() => {
        expect(adminAcceptSubmissionResultAction).toHaveBeenCalled();
      });
    });

    it("R focuses rejection reason", () => {
      renderPanel("under_review");
      fireEvent.keyDown(window, { key: "r" });
      expect(document.activeElement).toBe(document.getElementById("rejectionReason"));
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
});

// Silence unused import for create dialog transitive mock
void adminCreateArtistResultAction;
void searchAdminArtistsAction;
