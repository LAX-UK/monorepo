import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("leaves out summary facts the header already shows", () => {
    render(
      <DetailPanel
        open
        onOpenChange={() => {}}
        title="Ada Lovelace"
        status={<span>Possible match</span>}
        headerFacts={["Client", "Match"]}
        summary={[
          { label: "Client", value: "Ada Lovelace" },
          { label: "Match", value: "Possible match" },
          { label: "Monitoring", value: "Active" },
        ]}
      >
        {null}
      </DetailPanel>,
    );
    expect(screen.queryByText("Client")).toBeNull();
    expect(screen.queryByText("Match")).toBeNull();
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
  });

  it("only lets headerFacts name a fact the summary has", () => {
    const panel = (
      <DetailPanel
        open={false}
        onOpenChange={() => {}}
        title="Ada Lovelace"
        // @ts-expect-error "Clint" is not a summary label, so the build fails
        headerFacts={["Clint"]}
        summary={[{ label: "Client", value: "Ada Lovelace" }]}
      >
        {null}
      </DetailPanel>
    );
    expect(panel).toBeTruthy();
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

  it("keeps the footer's actions in view, clear of a phone's home indicator", () => {
    render(
      <DetailPanel
        open
        onOpenChange={() => {}}
        title="Hold 3"
        footer={<button type="button">Release hold</button>}
      >
        <p>Order details</p>
      </DetailPanel>,
    );
    const footer = screen
      .getByRole("button", { name: "Release hold" })
      .closest("[data-staff-panel-footer]");
    expect(footer).toHaveClass("sticky", "bottom-0");
    expect(footer?.className).toContain("env(safe-area-inset-bottom)");
    // Full width below 640px: the panel's own width only applies from `sm`.
    expect(screen.getByRole("dialog")).toHaveClass("w-full", "sm:w-[480px]");
  });

  describe("beside the list", () => {
    function stubViewport(wide: boolean) {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({
          matches: wide,
          addEventListener: () => {},
          removeEventListener: () => {},
        })),
      );
    }
    afterEach(() => vi.unstubAllGlobals());

    function renderBeside() {
      const onOpenChange = vi.fn();
      render(
        <>
          <button type="button">Lot 7 · Still life</button>
          <DetailPanel beside open onOpenChange={onOpenChange} title="Lot 42 · Harbour at dusk">
            <p>Delivery</p>
          </DetailPanel>
        </>,
      );
      return onOpenChange;
    }

    it("leaves the list in view and usable from 1024px: no scrim, the page keeps 480px clear", async () => {
      stubViewport(true);
      const onOpenChange = renderBeside();
      const panel = await screen.findByRole("dialog", { name: "Lot 42 · Harbour at dusk" });
      expect(panel).toHaveAttribute("data-staff-panel-beside", "480");
      expect(document.querySelector('[data-lax-motion="scrim"]')).toBeNull();
      // The list is not hidden from assistive technology, and a click on it keeps the panel.
      const row = screen.getByRole("button", { name: "Lot 7 · Still life" });
      fireEvent.pointerDown(row);
      fireEvent.click(row);
      expect(onOpenChange).not.toHaveBeenCalled();
      await vi.waitFor(() =>
        expect(screen.getByRole("heading", { name: "Lot 42 · Harbour at dusk" })).toHaveFocus(),
      );
      fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("covers the screen below 1024px, as any panel does", async () => {
      stubViewport(false);
      renderBeside();
      const panel = await screen.findByRole("dialog", { name: "Lot 42 · Harbour at dusk" });
      expect(panel).not.toHaveAttribute("data-staff-panel-beside");
      expect(document.querySelector('[data-lax-motion="scrim"]')).not.toBeNull();
    });
  });
});
