import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageUploadField } from "./image-upload-field";

vi.mock("@/lib/forms/image/use-upload-gallery", () => ({
  useUploadGallery: () => ({
    items: [{ id: "1", fileName: "a.jpg", status: "error" as const, message: "failed" }],
    uploadFiles: vi.fn(),
    retry: vi.fn(),
  }),
}));

describe("ImageUploadField", () => {
  it("blocks remove when disabled", () => {
    const onChange = vi.fn();
    render(
      <ImageUploadField
        kind="lot_image"
        value={["key-1"]}
        onChange={onChange}
        disabled
        previewUrlByKey={{ "key-1": "https://cdn/key-1" }}
      />,
    );
    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows retry on failed upload items", () => {
    render(<ImageUploadField kind="lot_image" value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Retry upload" })).toBeInTheDocument();
  });
});
