import { CatalogOrderedImageCollection } from "@/components/admin/catalog/media/catalog-ordered-image-collection";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forms/image/use-upload-gallery", () => ({
  useUploadGallery: () => ({
    items: [],
    uploadFiles: vi.fn(),
    retry: vi.fn(),
  }),
}));

describe("CatalogOrderedImageCollection", () => {
  const keys = ["https://cdn.example/primary.jpg", "https://cdn.example/detail.jpg"];

  it("shows empty dropzone and helper copy when the collection is empty", () => {
    renderWithViewer(
      <CatalogOrderedImageCollection kind="sale_cover" value={[]} onChange={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Add cover images" })).toBeInTheDocument();
    expect(
      screen.getByText(/Upload images, then drag to reorder. The first image is primary./),
    ).toBeInTheDocument();
  });

  it("hides the upload dropzone until add mode is requested", () => {
    renderWithViewer(
      <CatalogOrderedImageCollection
        kind="sale_cover"
        value={keys}
        onChange={vi.fn()}
        showAddPanel={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add more images" })).not.toBeInTheDocument();
  });

  it("shows manage controls and announces keyboard reorder moves", () => {
    const onChange = vi.fn();
    renderWithViewer(
      <CatalogOrderedImageCollection
        kind="sale_cover"
        value={keys}
        onChange={onChange}
        imageLabel="Cover image"
        showManage
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Move cover image 1 later" }));
    expect(onChange).toHaveBeenCalledWith([keys[1], keys[0]]);
    expect(
      screen.getByText(/Moved cover image 1 from position 1 to position 2/),
    ).toBeInTheDocument();
  });

  it("opens preview-only inspector when inspect index is set", () => {
    renderWithViewer(
      <CatalogOrderedImageCollection
        kind="sale_cover"
        value={keys}
        onChange={vi.fn()}
        inspectIndex={1}
        onInspectIndex={vi.fn()}
      />,
    );

    expect(screen.getByText("Preview only.")).toBeInTheDocument();
    expect(screen.getByText("Position 2 in the collection.")).toBeInTheDocument();
  });

  it("explains when the maximum image count is reached", () => {
    renderWithViewer(
      <CatalogOrderedImageCollection
        kind="sale_cover"
        value={keys}
        onChange={vi.fn()}
        maxFiles={2}
        showAddPanel
      />,
    );

    expect(screen.getByText(/Maximum of 2 images reached/)).toBeInTheDocument();
  });
});
