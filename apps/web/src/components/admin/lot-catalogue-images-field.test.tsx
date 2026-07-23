import { LotCatalogueImagesField } from "@/components/admin/lot-catalogue-images-field";
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

describe("LotCatalogueImagesField", () => {
  const images = [
    { key: "https://cdn.example/primary.jpg", alt: "Primary artwork" },
    { key: "https://cdn.example/detail.jpg", alt: "Artwork detail" },
  ];

  it("keeps add and manage capabilities available for a non-empty form gallery", () => {
    renderWithViewer(<LotCatalogueImagesField value={images} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add images" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("button", { name: "Move lot image 1 later" })).toBeInTheDocument();
  });

  it("remains read-only when disabled", () => {
    renderWithViewer(<LotCatalogueImagesField value={images} onChange={vi.fn()} disabled />);

    expect(screen.queryByRole("button", { name: "Add images" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
  });
});
