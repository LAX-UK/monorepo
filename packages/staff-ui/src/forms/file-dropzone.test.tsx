import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileDropzone } from "./file-dropzone.js";

const jpeg = new File(["a"], "a.jpg", { type: "image/jpeg" });
const pdf = new File(["b"], "b.pdf", { type: "application/pdf" });

describe("FileDropzone", () => {
  it("names the picker after its label and describes what it accepts", () => {
    render(
      <FileDropzone
        label="Upload images"
        hint="JPEG, PNG or WebP"
        accept="image/jpeg,image/png"
        onFiles={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/Upload images/);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAccessibleDescription("JPEG, PNG or WebP");
  });

  it("passes on only the files that match, and every one when multiple", () => {
    const onFiles = vi.fn();
    render(<FileDropzone label="Upload" accept="image/*" multiple onFiles={onFiles} />);
    fireEvent.change(screen.getByLabelText(/Upload/), { target: { files: [jpeg, pdf, jpeg] } });
    expect(onFiles).toHaveBeenCalledWith([jpeg, jpeg]);
  });

  it("takes dropped files", () => {
    const onFiles = vi.fn();
    const { container } = render(
      <FileDropzone label="Upload" accept="image/jpeg" onFiles={onFiles} />,
    );
    const zone = container.querySelector("label") as HTMLLabelElement;
    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-dragging");
    expect(zone).toHaveTextContent("Drop to upload");
    expect(zone).not.toHaveTextContent("Drag files here");
    fireEvent.drop(zone, { dataTransfer: { files: [jpeg] } });
    expect(onFiles).toHaveBeenCalledWith([jpeg]);
    expect(zone).not.toHaveAttribute("data-dragging");
    expect(zone).toHaveTextContent("Upload");
  });

  it("ignores files while disabled, including through its Field", () => {
    const onFiles = vi.fn();
    render(
      <Field label="Images" disabled>
        <FileDropzone label="Upload" accept="image/jpeg" onFiles={onFiles} />
      </Field>,
    );
    const input = screen.getByLabelText(/Upload/);
    expect(input).toBeDisabled();
    fireEvent.change(input, { target: { files: [jpeg] } });
    expect(onFiles).not.toHaveBeenCalled();
  });
});
