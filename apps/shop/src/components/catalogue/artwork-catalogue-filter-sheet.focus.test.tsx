/** @vitest-environment jsdom */
import { MarketingFilterSheet } from "@auction/marketing-ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <MarketingFilterSheet
      variant="catalogue"
      open={open}
      onOpenChange={setOpen}
      title="Filter and sort"
      trigger={<button type="button">Filter and sort</button>}
      applyLabel="Show 3 editions"
      onApply={() => setOpen(false)}
    >
      <button type="button">Inside</button>
    </MarketingFilterSheet>
  );
}

describe("catalogue filter sheet focus", () => {
  afterEach(cleanup);

  it("moves focus into the sheet and returns it to the opener after Apply", async () => {
    render(<Harness />);
    const opener = screen.getAllByRole("button", { name: "Filter and sort" })[0] as HTMLElement;
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Show 3 editions" }));
    await waitFor(() => expect(dialog.getAttribute("data-state")).toBe("closed"));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
