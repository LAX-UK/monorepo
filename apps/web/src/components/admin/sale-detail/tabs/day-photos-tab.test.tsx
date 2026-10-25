import { SaleDayPhotosTab } from "@/components/admin/sale-detail/tabs/day-photos-tab";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminUpdateSaleResultAction = vi.fn();

vi.mock("@/lib/actions/admin-sales", () => ({
  adminUpdateSaleResultAction: (...args: unknown[]) => adminUpdateSaleResultAction(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

vi.mock("@/hooks/use-upload-object-lifecycle", () => ({
  useUploadObjectLifecycle: () => ({
    uploadFile: vi.fn().mockRejectedValue(new Error("The file is over 200 MB.")),
  }),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// The grid's own menu is covered by the kit's tests; here each tile offers its removal directly,
// because the Radix menu is slow to open in jsdom.
vi.mock("@auction/staff-ui", async (importOriginal) => {
  const kit = await importOriginal<typeof import("@auction/staff-ui")>();
  return {
    ...kit,
    MediaGrid: (props: Parameters<typeof kit.MediaGrid>[0]) => (
      <ol>
        {props.items.map((item, index) => (
          <li key={item.id}>
            {props.renderDetails?.(item, index)}
            <button type="button" onClick={() => props.onRemove(index)}>
              Remove item {index + 1}
            </button>
          </li>
        ))}
      </ol>
    ),
  };
});

const photo = "uploads/pending/sale-day/photo-1.jpg";

describe("SaleDayPhotosTab", () => {
  beforeEach(() => {
    adminUpdateSaleResultAction.mockReset();
    adminUpdateSaleResultAction.mockResolvedValue({ ok: true });
  });

  it("asks before removing an item from a published gallery, then saves", async () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleStatus="ended"
        initialDayImages={[{ key: photo }]}
        previewUrlByKey={{ [photo]: "https://cdn.example/1.jpg" }}
        canManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(await screen.findByText("Remove photo 1 from the sale page?")).toBeInTheDocument();
    expect(adminUpdateSaleResultAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove from gallery" }));

    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", { dayImages: [] });
    });
  });

  it("says media before the sale ends is not saved, and offers no save", () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleStatus="active"
        initialDayImages={[]}
        previewUrlByKey={{}}
        canManage
      />,
    );

    expect(screen.getByText("Published once the sale ends")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Upload photos and videos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save and publish" })).not.toBeInTheDocument();
  });

  it("edits captions in place and saves them after the sale", async () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleStatus="ended"
        initialDayImages={[{ key: photo, caption: "Opening night" }]}
        previewUrlByKey={{ [photo]: "https://cdn.example/1.jpg" }}
        canManage
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Caption for photo 1" }), {
      target: { value: "The room at 7pm" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and publish" }));
    await waitFor(() => {
      expect(adminUpdateSaleResultAction).toHaveBeenCalledWith("sale-1", {
        dayImages: [{ key: photo, caption: "The room at 7pm" }],
      });
    });
  });

  it("keeps a failed upload in the list with a retry", async () => {
    renderWithViewer(
      <SaleDayPhotosTab
        saleId="sale-1"
        saleStatus="ended"
        initialDayImages={[]}
        previewUrlByKey={{}}
        canManage
      />,
    );

    const input = screen.getByLabelText(/^Upload photos and videos/);
    const file = new File(["x"], "floor.mp4", { type: "video/mp4" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("The file is over 200 MB.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry floor.mp4" })).toBeInTheDocument();
  });
});
