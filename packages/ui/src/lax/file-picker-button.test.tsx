import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilePickerButton } from "./index.js";

describe("FilePickerButton", () => {
  it("hands over the chosen files and keeps the native input hidden", () => {
    const onFiles = vi.fn();
    const { container } = render(
      <FilePickerButton onFiles={onFiles} accept="image/png" multiple>
        Attach
      </FilePickerButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute("aria-hidden", "true");
    expect(input).toHaveAttribute("accept", "image/png");
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it("does not open the chooser while a reason blocks it", () => {
    const { container } = render(
      <FilePickerButton onFiles={vi.fn()} disabledReason="Up to 5 files on one message">
        Attach
      </FilePickerButton>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Attach/ }));
    expect(click).not.toHaveBeenCalled();
  });
});
