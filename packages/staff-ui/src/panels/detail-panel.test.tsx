import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailPanel } from "./detail-panel.js";

function renderPanel(dirty: boolean) {
  const onOpenChange = vi.fn();
  render(
    <DetailPanel
      open
      onOpenChange={onOpenChange}
      title="LAX-10432"
      dirty={dirty}
      dirtyLabel="LAX-10432"
    >
      <p>Order details</p>
    </DetailPanel>,
  );
  return onOpenChange;
}

describe("DetailPanel", () => {
  it("closes straight away when nothing is unsaved", () => {
    const onOpenChange = renderPanel(false);
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks before closing over unsaved changes", async () => {
    const onOpenChange = renderPanel(true);
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    await screen.findByRole("dialog", { name: "Discard changes to LAX-10432?" });
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close panel", hidden: true }));
    await screen.findByRole("dialog", { name: "Discard changes to LAX-10432?" });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
