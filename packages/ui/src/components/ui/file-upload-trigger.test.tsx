import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileUploadTrigger } from "./file-upload-trigger.js";

describe("FileUploadTrigger button mode", () => {
  it("keeps the large kit button by default", () => {
    render(<FileUploadTrigger onFilesSelected={vi.fn()}>Upload</FileUploadTrigger>);
    expect(screen.getByRole("button", { name: "Upload" }).className).toContain("min-h-11");
  });

  it("takes a kit size and button classes, so row actions can share one size and width", () => {
    render(
      <FileUploadTrigger onFilesSelected={vi.fn()} buttonSize="default" buttonClassName="min-w-28">
        Replace
      </FileUploadTrigger>,
    );
    const button = screen.getByRole("button", { name: "Replace" });
    expect(button.className).toContain("min-h-9");
    expect(button.className).toContain("min-w-28");
  });

  it("marks the button busy and links it to its description", () => {
    render(
      <FileUploadTrigger onFilesSelected={vi.fn()} busy describedById="upload-error">
        Sending…
      </FileUploadTrigger>,
    );
    const button = screen.getByRole("button", { name: "Sending…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-describedby", "upload-error");
    expect(button).toBeDisabled();
  });
});
