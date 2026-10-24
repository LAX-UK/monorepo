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
  it("never repeats a meta fact in the summary", () => {
    render(
      <DetailPanel
        open
        onOpenChange={() => {}}
        title="Halcyon Gallery"
        meta={[
          { label: "Kind", value: "Organisation" },
          { label: "Updated", value: "24 Oct 2026" },
        ]}
        summary={[
          { label: "Kind", value: "Organisation" },
          { label: "Stripe requirements", value: "None due" },
          { label: "Updated", value: "24 Oct 2026, 14:05 BST" },
        ]}
      >
        {null}
      </DetailPanel>,
    );
    expect(screen.getAllByText("Kind")).toHaveLength(1);
    expect(screen.getAllByText("Updated")).toHaveLength(1);
    expect(screen.getByText("Stripe requirements")).toBeInTheDocument();
  });

  it("starts focus on the title, not on a header button", async () => {
    render(
      <DetailPanel
        open
        onOpenChange={() => {}}
        title="Golden Hour"
        overflow={<button type="button">More actions</button>}
      >
        <p>Payment</p>
      </DetailPanel>,
    );
    const heading = await screen.findByRole("heading", { name: "Golden Hour" });
    await vi.waitFor(() => expect(heading).toHaveFocus());
  });

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
