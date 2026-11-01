import { fireEvent, render, screen, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Dialog,
  EmptyState,
  ExportSheet,
  FilterChips,
  PresetCards,
  ShowingCount,
  Switch,
  ToggleRow,
  TooltipProvider,
} from "./index.js";

describe("Switch, locked", () => {
  it("stays focusable, says why, and never changes", () => {
    const onCheckedChange = vi.fn();
    render(
      <TooltipProvider>
        <Switch
          aria-label="Lot closing soon"
          lockedReason="Required while you're bidding"
          onCheckedChange={onCheckedChange}
        />
      </TooltipProvider>,
    );
    const control = screen.getByRole("switch", { name: "Lot closing soon" });
    expect(control).toBeChecked();
    expect(control).not.toBeDisabled();
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control).toHaveAccessibleDescription("On. Required while you're bidding");
    fireEvent.click(control);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(control).toBeChecked();
    // Drawn on, never as a faded or off control.
    expect(control.className).toContain("bg-lax-ink");
  });
});

describe("ToggleRow", () => {
  it("names the switch with its label and describes it with its line", () => {
    render(
      <ToggleRow
        label="Lot closing soon"
        description="An hour before a lot you bid on closes."
        checked
        onCheckedChange={() => undefined}
      />,
    );
    const control = screen.getByRole("switch", { name: "Lot closing soon" });
    expect(control).toHaveAccessibleDescription("An hour before a lot you bid on closes.");
  });

  it("announces a failed save in place of the description", () => {
    render(
      <ToggleRow
        label="Payout sent"
        description="When a payout leaves us."
        checked={false}
        onCheckedChange={() => undefined}
        error="Couldn't save. Try again."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save. Try again.");
  });

  it("shows a locked row's reason as readable text", () => {
    render(
      <TooltipProvider>
        <ToggleRow
          label="Outbid"
          checked
          onCheckedChange={() => undefined}
          lockedReason="Required while you're bidding"
        />
      </TooltipProvider>,
    );
    expect(screen.getAllByText("Required while you're bidding")[0]).toBeVisible();
  });
});

function Presets() {
  const [value, setValue] = useState<"all" | "closing" | "none">("all");
  return (
    <PresetCards
      value={value}
      onValueChange={setValue}
      label="Alert style"
      options={[
        { value: "all", label: "Everything", description: "Outbid, wins and payments." },
        { value: "closing", label: "Closing only", description: "Adds closing reminders." },
        { value: "none", label: "Quiet", disabledReason: "Available once you bid" },
      ]}
    />
  );
}

describe("PresetCards", () => {
  it("is a radio group whose cards are named by their title and described by their line", () => {
    render(<Presets />);
    const group = screen.getByRole("radiogroup", { name: "Alert style" });
    const everything = within(group).getByRole("radio", { name: "Everything" });
    expect(everything).toBeChecked();
    expect(everything).toHaveAccessibleDescription("Outbid, wins and payments.");
  });

  it("chooses a card on click and says why a card is unavailable", () => {
    render(<Presets />);
    fireEvent.click(screen.getByRole("radio", { name: "Closing only" }));
    expect(screen.getByRole("radio", { name: "Closing only" })).toBeChecked();
    const quiet = screen.getByRole("radio", { name: "Quiet" });
    expect(quiet).toBeDisabled();
    expect(quiet).toHaveAccessibleDescription("Available once you bid");
  });

  it("drops the card height in its compact size, for a list of choices in a dialog", () => {
    render(
      <PresetCards
        compact
        columns={1}
        value="viewer"
        onValueChange={() => {}}
        label="Role"
        options={[{ value: "viewer", label: "Viewer", description: "Changes nothing." }]}
      />,
    );
    const card = screen.getByRole("radio", { name: "Viewer" });
    expect(card.className).toContain("min-h-0");
    expect(card.className).toContain("py-3");
  });
});

describe("PresetCards, chosen card", () => {
  it("hands the chosen card to the caller, so a dialog can put focus on it", () => {
    const checked = createRef<HTMLButtonElement>();
    render(
      <PresetCards
        value="b"
        onValueChange={() => {}}
        label="Bid type"
        checkedRef={checked}
        options={[
          { value: "a", label: "Next bid" },
          { value: "b", label: "Maximum" },
        ]}
      />,
    );
    expect(checked.current).toBe(screen.getByRole("radio", { name: "Maximum" }));
  });
});

describe("FilterChips", () => {
  it("removes a chip by its own button and moves focus to the next one", () => {
    const onRemove = vi.fn();
    render(
      <FilterChips
        filters={[
          { id: "sent", label: "Sent by: Lena Fischer" },
          { id: "sale", label: "Sale: Autumn online" },
        ]}
        onRemove={onRemove}
        onClearAll={() => undefined}
      />,
    );
    expect(screen.getByRole("list", { name: "Applied filters" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Sent by: Lena Fischer" }));
    expect(onRemove).toHaveBeenCalledWith("sent");
    expect(screen.getByRole("button", { name: "Remove filter Sale: Autumn online" })).toHaveFocus();
  });

  it("renders nothing without filters", () => {
    const { container } = render(
      <FilterChips filters={[]} onRemove={() => undefined} onClearAll={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ShowingCount", () => {
  it("says how many of how many, and offers more while there are more", () => {
    const onShowMore = vi.fn();
    const { rerender } = render(<ShowingCount shown={5} total={14} onShowMore={onShowMore} />);
    expect(screen.getByText("Showing 5 of 14")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(onShowMore).toHaveBeenCalled();
    rerender(<ShowingCount shown={14} total={14} onShowMore={onShowMore} />);
    expect(screen.getByText("Showing all 14")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Invite
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Invite members"
        description="Up to 20 at once."
      >
        <p>Body</p>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("is a titled, described dialog that returns focus when closed", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Invite" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Invite members" });
    expect(dialog).toHaveAccessibleDescription("Up to 20 at once.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("Dialog, focus on closing", () => {
  it("falls back to the given element when the control that opened it is gone", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          {open ? null : (
            <button type="button" onClick={() => setOpen(true)}>
              Bid
            </button>
          )}
          <div tabIndex={-1} data-testid="area" />
          <Dialog
            open={open}
            onOpenChange={setOpen}
            title="Place a bid"
            returnFocusFallback={() => screen.getByTestId("area")}
          >
            <p>Body</p>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Bid" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Place a bid" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(screen.getByTestId("area")).toHaveFocus());
  });
});

describe("ExportSheet", () => {
  it("exports the view in the chosen format, then closes", async () => {
    const onExport = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ExportSheet
        open
        onOpenChange={onOpenChange}
        subject="sold works"
        viewCount={23}
        defaultFormat="csv"
        formats={[
          { value: "csv", label: "Spreadsheet (CSV)", description: "Opens in Excel and Numbers." },
          {
            value: "pdf",
            label: "Statements (PDF)",
            description: "One file per payout, in a zip.",
          },
        ]}
        onExport={onExport}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Export sold works" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Statements (PDF)" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onExport).toHaveBeenCalledWith({ scope: "view", format: "pdf" });
  });

  it("will not export a period that ends before it starts, and says why", () => {
    render(
      <TooltipProvider>
        <ExportSheet
          open
          onOpenChange={() => undefined}
          subject="purchases"
          viewCount={3}
          defaultFormat="csv"
          formats={[{ value: "csv", label: "Spreadsheet (CSV)" }]}
          period={{ from: "2026-10-30", to: "2026-01-01" }}
          onExport={() => undefined}
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose a date after the start")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("names the page's state with its heading and keeps the drawing out of the reading order", () => {
    const { container } = render(
      <EmptyState
        illustration="easel"
        title="No consignments yet"
        description="Send us a work to sell and follow it from review to sale."
        actions={<button type="button">Sell a work</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "No consignments yet" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector("[data-illustration=easel]")?.closest("[aria-hidden]"),
    ).not.toBeNull();
  });

  it("is the page's h1 when it is the whole page", () => {
    render(
      <EmptyState
        headingLevel="h1"
        illustration="search"
        title="We can't find that lot"
        description="Search or browse."
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "We can't find that lot" }),
    ).toBeInTheDocument();
  });
});
