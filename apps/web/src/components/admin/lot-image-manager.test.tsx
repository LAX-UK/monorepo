import { LotImageManager } from "@/components/admin/lot-image-manager";
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

describe("LotImageManager", () => {
  const images = [
    { key: "https://cdn.example/primary.jpg", alt: "Primary artwork" },
    { key: "https://cdn.example/detail.jpg", alt: "Artwork detail" },
  ];

  it("opens alt editing in the inspector", () => {
    const onChange = vi.fn();
    renderWithViewer(
      <LotImageManager
        value={images}
        onChange={onChange}
        inspectIndex={1}
        onInspectIndex={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("Artwork detail")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Artwork detail"), {
      target: { value: "Close crop of the signature" },
    });
    expect(onChange).toHaveBeenCalledWith([
      images[0],
      { ...images[1], alt: "Close crop of the signature" },
    ]);
  });

  it("shows manage controls for reorder and hero changes", () => {
    const onChange = vi.fn();
    renderWithViewer(<LotImageManager value={images} onChange={onChange} showManage />);

    expect(screen.getAllByText("Catalogue hero").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Move lot image 1 earlier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move lot image 2 later" })).toBeDisabled();
  });

  it("announces keyboard reorder moves and supports hero changes in manage mode", () => {
    const onChange = vi.fn();
    renderWithViewer(<LotImageManager value={images} onChange={onChange} showManage />);

    fireEvent.click(screen.getByRole("button", { name: "Make hero" }));
    expect(onChange).toHaveBeenCalledWith([images[1], images[0]]);

    fireEvent.click(screen.getByRole("button", { name: "Move lot image 1 later" }));
    expect(screen.getByText(/Moved image 1 from position 1 to position 2/)).toBeInTheDocument();
  });

  it("hides the upload dropzone until add mode is requested", () => {
    renderWithViewer(<LotImageManager value={images} onChange={vi.fn()} showAddPanel={false} />);

    expect(screen.queryByRole("button", { name: "Add more images" })).not.toBeInTheDocument();
  });

  it("shows the add panel dropzone and confirms staged removal", () => {
    const onChange = vi.fn();
    renderWithViewer(
      <LotImageManager value={images} onChange={onChange} maxFiles={5} showAddPanel showManage />,
    );

    expect(screen.getByRole("button", { name: "Add more images" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove lot image 1" }));
    expect(screen.getByText("Remove this lot image?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith([images[1]]);
  });

  it("explains when the maximum image count is reached", () => {
    renderWithViewer(
      <LotImageManager value={images} onChange={vi.fn()} maxFiles={2} showAddPanel showManage />,
    );

    expect(screen.getByText(/Maximum of 2 lot images reached/)).toBeInTheDocument();
  });
});
