import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileAttachment } from "./index.js";

describe("FileAttachment", () => {
  it("opens the file from its name and downloads it from the control", () => {
    render(<FileAttachment name="frame-label.jpg" href="/f/1" kind="image" size="1.8 MB" />);
    const open = screen.getByRole("link", { name: "frame-label.jpg (opens in a new tab)" });
    expect(open).toHaveAttribute("target", "_blank");
    const download = screen.getByRole("link", { name: "Download frame-label.jpg" });
    expect(download).toHaveAttribute("download", "frame-label.jpg");
    expect(screen.getByText("Photo · 1.8 MB")).toBeInTheDocument();
  });

  it("shows a photo's thumbnail (the icon when it cannot load), and a PDF's type", () => {
    const { container, rerender } = render(
      <FileAttachment name="a.jpg" href="/f/a" kind="image" thumbnailUrl="/t/a" />,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "/t/a");
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
    rerender(<FileAttachment name="report.pdf" href="/f/b" kind="pdf" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("falls back to the icon for a preview that failed before it was watched", () => {
    const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get: () => true,
    });
    try {
      const { container } = render(
        <FileAttachment name="a.jpg" href="/f/a" kind="image" thumbnailUrl="/missing.jpg" />,
      );
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("svg")).not.toBeNull();
    } finally {
      if (complete) Object.defineProperty(HTMLImageElement.prototype, "complete", complete);
    }
  });
});
