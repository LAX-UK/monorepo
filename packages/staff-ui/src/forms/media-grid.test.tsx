import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaGrid } from "./media-grid.js";
import { UploadQueue } from "./upload-queue.js";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

function renderGrid(overrides: Partial<Parameters<typeof MediaGrid>[0]> = {}) {
  const onMove = vi.fn();
  const onRemove = vi.fn();
  render(
    <MediaGrid
      items={items}
      noun="photo"
      primaryLabel="Cover"
      renderPreview={(item) => <img src={`/${item.id}.jpg`} alt={`Artwork ${item.id}`} />}
      onMove={onMove}
      onRemove={onRemove}
      {...overrides}
    />,
  );
  return { onMove, onRemove };
}

describe("MediaGrid", () => {
  it("numbers each tile and marks the first with its role", () => {
    renderGrid();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Cover")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Artwork b" })).toBeInTheDocument();
  });

  it("moves a tile with the arrow keys on its handle and announces it", () => {
    const { onMove } = renderGrid();
    const handle = screen.getByRole("button", { name: "Move photo 2" });
    expect(handle).toHaveAccessibleDescription(/arrow key/);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onMove).toHaveBeenLastCalledWith(1, 2);
    expect(screen.getByText("Photo moved to position 3 of 3.")).toBeInTheDocument();
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onMove).toHaveBeenLastCalledWith(1, 0);
  });

  it("does not move past either end", () => {
    const { onMove } = renderGrid();
    fireEvent.keyDown(screen.getByRole("button", { name: "Move photo 1" }), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Move photo 3" }), { key: "ArrowRight" });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("reorders by drag and drop", () => {
    const { onMove } = renderGrid();
    const [first, , third] = screen.getAllByRole("listitem");
    if (!first || !third) throw new Error("tiles missing");
    const dataTransfer = { effectAllowed: "" };
    fireEvent.dragStart(third, { dataTransfer });
    fireEvent.dragOver(first, { dataTransfer });
    fireEvent.drop(first, { dataTransfer });
    expect(onMove).toHaveBeenCalledWith(2, 0);
  });

  it("offers no reordering when disabled", () => {
    renderGrid({ disabled: true });
    expect(screen.queryByRole("button", { name: /^Move photo/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
  });
});

describe("UploadQueue", () => {
  it("shows progress, checking and a failure with retry", () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UploadQueue
        items={[
          { id: "1", name: "front.jpg", status: "uploading", progress: 40 },
          { id: "2", name: "back.jpg", status: "processing" },
          { id: "3", name: "huge.tif", status: "error", error: "The file is over 20 MB." },
        ]}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Uploading front.jpg" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(screen.getByText("Checking the file…")).toBeInTheDocument();
    expect(screen.getByText("The file is over 20 MB.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry huge.tif" }));
    expect(onRetry).toHaveBeenCalledWith("3");
    fireEvent.click(screen.getByRole("button", { name: "Remove huge.tif from the list" }));
    expect(onDismiss).toHaveBeenCalledWith("3");
  });

  it("offers only removal for a file that retrying cannot fix", () => {
    const onDismiss = vi.fn();
    render(
      <UploadQueue
        items={[
          {
            id: "1",
            name: "scan.tif",
            status: "error",
            error: "This file type is not supported.",
            retryable: false,
          },
        ]}
        onRetry={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Retry/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove scan.tif" }));
    expect(onDismiss).toHaveBeenCalledWith("1");
  });
});
