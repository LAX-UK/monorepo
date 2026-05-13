import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BidPanelTabs } from "./bid-panel-tabs";

describe("BidPanelTabs", () => {
  it("cycles focus and selection with arrow keys", () => {
    render(<BidPanelTabs bidPanel={<div>Bids body</div>} videoPanel={<div>Video body</div>} />);
    const bidsTab = screen.getByRole("tab", { name: /bids view/i });
    const videoTab = screen.getByRole("tab", { name: /video stream/i });
    bidsTab.focus();
    expect(bidsTab).toHaveAttribute("tabIndex", "0");
    fireEvent.keyDown(bidsTab, { key: "ArrowRight" });
    expect(videoTab).toHaveAttribute("aria-selected", "true");
    expect(videoTab).toHaveAttribute("tabIndex", "0");
    fireEvent.keyDown(videoTab, { key: "ArrowLeft" });
    expect(bidsTab).toHaveAttribute("aria-selected", "true");
  });
});
