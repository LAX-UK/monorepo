import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileMetadataList } from "./file-metadata-list.js";

const files = [
  { id: "f1", name: "frame-label.jpg", detail: "JPEG image · 2.1 MB", kind: "image" as const },
  { id: "f2", name: "condition.pdf", detail: "PDF · 340 KB", kind: "document" as const },
];

describe("FileMetadataList", () => {
  it("names each file with its type and size, under the list's label", () => {
    render(<FileMetadataList files={files} label="Files named in this email" />);
    const list = screen.getByRole("list", { name: "Files named in this email" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("frame-label.jpg")).toBeTruthy();
    expect(within(list).getByText("PDF · 340 KB")).toBeTruthy();
  });

  it("offers nothing to open or download", () => {
    const { container } = render(<FileMetadataList files={files} label="Files" />);
    expect(container.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("says why, when given a note", () => {
    render(<FileMetadataList files={files} label="Files" note="The files were not kept." />);
    expect(screen.getByText("The files were not kept.")).toBeTruthy();
  });

  it("renders nothing without files", () => {
    const { container } = render(<FileMetadataList files={[]} label="Files" />);
    expect(container.innerHTML).toBe("");
  });
});
