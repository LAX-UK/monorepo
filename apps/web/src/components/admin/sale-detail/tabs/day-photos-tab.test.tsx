import { SaleDayPhotosTab } from "@/components/admin/sale-detail/tabs/day-photos-tab";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminUpdateSaleResultAction = vi.fn();

vi.mock("@/lib/actions/admin-sales", () => ({
  adminUpdateSaleResultAction: (...args: unknown[]) => adminUpdateSaleResultAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/hooks/use-upload-object-lifecycle", () => ({
  useUploadObjectLifecycle: () => ({
    uploadFile: vi.fn(),
  }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("SaleDayPhotosTab remove", () => {
  beforeEach(() => {
    adminUpdateSaleResultAction.mockReset();
    adminUpdateSaleResultAction.mockResolvedValue({ ok: true });
  });

  it("persists removal after confirm when the sale has ended", async () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleTitle="Test sale"
        saleStatus="ended"
        initialDayImages={[{ key: "uploads/pending/sale-day/photo-1.jpg" }]}
        previewUrlByKey={{ "uploads/pending/sale-day/photo-1.jpg": "https://cdn.example/1.jpg" }}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(screen.getByText("Remove from public gallery?")).toBeInTheDocument();
    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Remove item 1" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", { dayImages: [] });
    });
  });

  it("keeps pre-ended media in a clearly labelled draft workspace", () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleTitle="Test sale"
        saleStatus="live"
        initialDayImages={[]}
        previewUrlByKey={{}}
        canManage
      />,
    );

    expect(screen.getByText("Draft mode")).toBeInTheDocument();
    const addMediaButtons = screen.getAllByRole("button", { name: "Add media" });
    const addMediaButton = addMediaButtons[0];
    if (!addMediaButton) {
      throw new Error("Expected an Add media button");
    }
    fireEvent.click(addMediaButton);
    expect(screen.getByRole("button", { name: "Add photos and videos" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save media" })).not.toBeInTheDocument();
  });

  it("opens metadata editing in the inspector instead of inline card fields", () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleTitle="Test sale"
        saleStatus="ended"
        initialDayImages={[
          { key: "uploads/pending/sale-day/photo-1.jpg", caption: "Opening night" },
        ]}
        previewUrlByKey={{ "uploads/pending/sale-day/photo-1.jpg": "https://cdn.example/1.jpg" }}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByLabelText("Caption")).toBeInTheDocument();
    expect(screen.getByLabelText("Alt text")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Photo 1 details/i })).toBeInTheDocument();
  });
});
