import { DocumentAttachmentManager } from "@/components/admin/document-attachment-manager";
import { renderWithViewer } from "@/test/render-with-viewer";
import type { EntityDocument } from "@auction/types";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-upload-object-lifecycle", () => ({
  useUploadObjectLifecycle: () => ({
    uploadFile: vi.fn().mockResolvedValue({
      uploadObjectId: "00000000-0000-4000-8000-000000000099",
      publicUrl: "https://cdn.example.com/cat.pdf",
      key: "uploads/cat.pdf",
    }),
  }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const createdDoc: EntityDocument = {
  id: "doc-1",
  entityKind: "sale",
  entityId: "sale-1",
  kind: "catalog",
  label: null,
  uploadObjectId: "00000000-0000-4000-8000-000000000099",
  downloadUrl: "https://cdn.example.com/cat.pdf",
  fileName: "catalog.pdf",
  byteSize: 1024,
  contentType: "application/pdf",
  createdByUserId: "user-1",
  createdAt: new Date(),
};

describe("DocumentAttachmentManager", () => {
  it("uploads and attaches in one action without Attach to record button", async () => {
    const attach = vi.fn().mockResolvedValue({ ok: true, data: createdDoc });
    const remove = vi.fn().mockResolvedValue({ ok: true, data: undefined });

    renderWithViewer(
      <DocumentAttachmentManager
        entityKind="sale"
        entityId="sale-1"
        kinds={["catalog", "terms"]}
        initialDocuments={[]}
        actions={{ attach, remove }}
      />,
    );

    expect(screen.queryByRole("button", { name: /attach to record/i })).not.toBeInTheDocument();
    expect(screen.getByText("Sale catalogue")).toBeInTheDocument();

    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("file input not found");
    }
    const file = new File(["pdf"], "catalog.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(attach).toHaveBeenCalledWith({
        uploadObjectId: "00000000-0000-4000-8000-000000000099",
        kind: "catalog",
        label: null,
      });
    });

    expect(await screen.findByText("catalog.pdf")).toBeInTheDocument();
  });
});
