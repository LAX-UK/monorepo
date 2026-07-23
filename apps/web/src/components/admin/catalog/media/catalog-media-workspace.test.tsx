import {
  CatalogMediaCard,
  CatalogMediaDropzone,
  CatalogMediaInspector,
  CatalogMediaWorkspace,
  MediaReorderLiveRegion,
} from "@/components/admin/catalog/media";
import { Button } from "@auction/ui/components/button";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("catalog media workspace", () => {
  it("renders collection chrome, add panel, count, save bar, and live region", () => {
    render(
      <CatalogMediaWorkspace
        title="Images"
        description="Manage catalogue images."
        count={2}
        addPanel={<div>Add panel</div>}
        saveBar={<Button type="button">Save changes</Button>}
        liveRegion={<MediaReorderLiveRegion message="Moved image 2 to position 1." />}
        footer={<span>2 images · Unsaved changes</span>}
      >
        <ol className="grid sm:grid-cols-2 xl:grid-cols-3">
          <CatalogMediaCard
            title="Primary artwork"
            orderLabel="Image 1"
            primaryLabel="Catalogue hero"
            isHero
            media={<div>Preview</div>}
          />
        </ol>
      </CatalogMediaWorkspace>,
    );

    expect(screen.getByText("Images")).toBeInTheDocument();
    expect(screen.getByText("Add panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByText("Catalogue hero")).toBeInTheDocument();
    expect(screen.getByText("2 images · Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("passes selected files through the accessible dropzone", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(
      <CatalogMediaDropzone
        inputId="test-media"
        title="Add images"
        description="JPEG, PNG, or WebP up to 10 MB."
        accept="image/jpeg,image/png,image/webp"
        onFilesSelected={onFilesSelected}
      />,
    );

    expect(screen.getByRole("button", { name: "Add images" })).toBeInTheDocument();
    expect(screen.getByText("JPEG, PNG, or WebP up to 10 MB.")).toBeInTheDocument();

    const input = container.querySelector('input[type="file"]');
    const file = new File(["image"], "artwork.webp", { type: "image/webp" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    expect(onFilesSelected).toHaveBeenCalledTimes(1);
  });

  it("renders upload errors and retry controls in the dropzone queue slot", () => {
    render(
      <CatalogMediaDropzone
        inputId="error-media"
        title="Add media"
        description="Choose a supported file."
        accept="image/jpeg"
        onFilesSelected={vi.fn()}
        queue={
          <div role="alert">
            Upload failed <Button type="button">Retry upload</Button>
          </div>
        }
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    expect(screen.getByRole("button", { name: "Retry upload" })).toBeInTheDocument();
  });

  it("renders inspector sheet content when open", () => {
    render(
      <CatalogMediaInspector
        open
        onOpenChange={vi.fn()}
        title="Image details"
        description="Edit metadata"
        preview={<div>Inspector preview</div>}
      >
        <label htmlFor="alt">Alt text</label>
        <input id="alt" defaultValue="Primary artwork" />
      </CatalogMediaInspector>,
    );

    expect(screen.getByText("Image details")).toBeInTheDocument();
    expect(screen.getByText("Edit metadata")).toBeInTheDocument();
    expect(screen.getByText("Inspector preview")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Primary artwork")).toBeInTheDocument();
  });

  it("uses a dedicated details button instead of nesting controls in an interactive card", () => {
    render(
      <ol>
        <CatalogMediaCard
          title="Primary artwork"
          media={<div>Preview</div>}
          onOpen={vi.fn()}
          actions={<Button type="button">Remove</Button>}
        />
      </ol>,
    );

    expect(screen.getByRole("listitem")).not.toHaveAttribute("role", "button");
    expect(screen.getByRole("button", { name: "Primary artwork" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
