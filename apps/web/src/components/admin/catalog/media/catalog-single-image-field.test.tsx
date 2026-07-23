import { CatalogSingleImageField } from "@/components/admin/catalog/media/catalog-single-image-field";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/forms/image/use-upload-gallery", () => ({
  useUploadGallery: () => ({
    items: [{ id: "1", fileName: "a.jpg", status: "error" as const, message: "failed" }],
    uploadFiles: vi.fn(),
    retry: vi.fn(),
  }),
}));

describe("CatalogSingleImageField", () => {
  it("shows shared dropzone when empty", () => {
    render(<CatalogSingleImageField kind="artist_image" value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add artist image" })).toBeInTheDocument();
  });

  it("shows preview with replace and remove when a value exists", () => {
    const onChange = vi.fn();
    render(
      <CatalogSingleImageField
        kind="artist_image"
        value="portrait-key"
        onChange={onChange}
        previewUrlByKey={{ "portrait-key": "https://cdn/portrait.jpg" }}
      />,
    );

    expect(screen.getByRole("button", { name: "Replace image" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("blocks remove when disabled", () => {
    const onChange = vi.fn();
    render(
      <CatalogSingleImageField
        kind="category_image"
        value="hero-key"
        onChange={onChange}
        disabled
        previewUrlByKey={{ "hero-key": "https://cdn/hero.jpg" }}
      />,
    );

    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows retry on failed upload items", () => {
    render(<CatalogSingleImageField kind="artist_image" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Retry upload" })).toBeInTheDocument();
  });
});
