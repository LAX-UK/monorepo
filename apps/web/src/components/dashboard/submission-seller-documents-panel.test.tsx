import { SubmissionSellerDocumentsPanel } from "@/components/dashboard/submission-seller-documents-panel";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { EntityDocument } from "@auction/types";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-upload-object-lifecycle", () => ({
  useUploadObjectLifecycle: () => ({
    uploadFile: vi.fn().mockResolvedValue({
      uploadObjectId: "00000000-0000-4000-8000-000000000099",
      publicUrl: "https://cdn.example.com/certificate.pdf",
      key: "uploads/certificate.pdf",
    }),
  }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const attach = vi.fn();
vi.mock("@/lib/actions/seller-submission-documents", () => ({
  sellerAttachSubmissionDocumentResultAction: (...args: unknown[]) => attach(...args),
  sellerRemoveSubmissionDocumentResultAction: vi.fn(),
}));

const certificate: EntityDocument = {
  id: "doc-1",
  entityKind: "submission",
  entityId: "s1",
  kind: "provenance",
  label: null,
  uploadObjectId: "00000000-0000-4000-8000-000000000099",
  downloadUrl: "https://cdn.example.com/certificate.pdf",
  fileName: "certificate.pdf",
  byteSize: 1024 * 1024 * 2,
  contentType: "application/pdf",
  createdByUserId: "user-1",
  createdAt: new Date(),
};

describe("SubmissionSellerDocumentsPanel", () => {
  it("says there are none in one line and opens the uploader from Add a document", async () => {
    attach.mockResolvedValue({ ok: true, data: certificate });
    renderWithViewer(
      <SubmissionSellerDocumentsPanel
        submissionId="s1"
        status="under_review"
        initialDocuments={[]}
        canManage
      />,
    );
    expect(screen.getByText("You haven't added any documents.")).toBeInTheDocument();
    expect(screen.getByText(/help your specialist review the work/)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add a document" }));
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("file input not found");
    fireEvent.change(input, {
      target: { files: [new File(["pdf"], "certificate.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() =>
      expect(attach).toHaveBeenCalledWith("s1", {
        uploadObjectId: "00000000-0000-4000-8000-000000000099",
        kind: "provenance",
        label: null,
      }),
    );
    expect(
      await screen.findByRole("link", { name: "certificate.pdf (opens in a new tab)" }),
    ).toBeInTheDocument();
  });

  it("after review, says what documents are for; read-only members get no add action", () => {
    const { unmount } = renderWithViewer(
      <SubmissionSellerDocumentsPanel
        submissionId="s1"
        status="converted"
        initialDocuments={[certificate]}
        canManage
      />,
    );
    expect(screen.getByText(/helps us sell the work/)).toBeInTheDocument();
    expect(screen.queryByText(/review/)).toBeNull();
    unmount();
    renderWithViewer(
      <SubmissionSellerDocumentsPanel
        submissionId="s1"
        status="converted"
        initialDocuments={[certificate]}
        canManage={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Add a document" })).toBeNull();
    expect(screen.getByText("PDF · 2.0 MB · Provenance")).toBeInTheDocument();
  });
});
