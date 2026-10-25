import { LotCatalogueImagesField } from "@/components/admin/lot-catalogue-images-field";
import { renderWithViewer } from "@/test/render-with-viewer";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forms/image/use-upload-gallery", () => ({
  useUploadGallery: () => ({
    items: [
      { id: "u1", fileName: "back.jpg", status: "error", message: "The file is over 10 MB." },
    ],
    uploadFiles: vi.fn(),
    retry: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

describe("LotCatalogueImagesField", () => {
  const images = [
    { key: "https://cdn.example/primary.jpg", alt: "Primary artwork" },
    { key: "https://cdn.example/detail.jpg", alt: "Artwork detail" },
  ];

  it("lists the photos in order with their alt text, a failed upload and a way to add more", () => {
    const onChange = vi.fn();
    renderWithViewer(<LotCatalogueImagesField value={images} onChange={onChange} />);

    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("The file is over 10 MB.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Add photos/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Alt text for photo 2" }), {
      target: { value: "Signature" },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      images[0],
      { key: "https://cdn.example/detail.jpg", alt: "Signature" },
    ]);
    fireEvent.keyDown(screen.getByRole("button", { name: "Move photo 1" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith([images[1], images[0]]);
  });

  it("offers no changes when disabled", () => {
    renderWithViewer(<LotCatalogueImagesField value={images} onChange={vi.fn()} disabled />);

    expect(screen.queryByRole("button", { name: /^Move photo/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Add photos/)).toBeDisabled();
  });
});
