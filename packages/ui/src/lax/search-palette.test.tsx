import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  type PaletteGroup,
  type PaletteItem,
  SearchPalette,
  type SearchPaletteProps,
  useSearchPaletteShortcut,
} from "./index.js";

const GROUPS: PaletteGroup[] = [
  {
    id: "lots",
    label: "Lots",
    items: [
      { id: "57", label: "Harbour at dawn", meta: "Lot 57 · won" },
      { id: "29", label: "Harbour, first light", meta: "Lot 29 · sold" },
    ],
  },
  { id: "pages", label: "Pages", items: [{ id: "sold", label: "Sold & payouts", meta: "Page" }] },
];

function Harness(props: Partial<SearchPaletteProps> & { onSelect?: (item: PaletteItem) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Search
      </button>
      <SearchPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        placeholder="Search Northbank Gallery"
        groups={GROUPS}
        onSelect={props.onSelect ?? (() => undefined)}
        {...props}
      />
    </>
  );
}

function openPalette() {
  const trigger = screen.getByRole("button", { name: "Search" });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, input: screen.getByRole("combobox", { name: "Search Northbank Gallery" }) };
}

describe("SearchPalette", () => {
  it("is a combobox controlling a listbox of grouped options", () => {
    render(<Harness />);
    const { input } = openPalette();
    const listbox = screen.getByRole("listbox", { name: "Results" });
    expect(input).toHaveAttribute("aria-controls", listbox.id);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(screen.getByRole("group", { name: "Lots" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("moves the active option with the arrows, wraps at both ends, and keeps focus in the field", async () => {
    render(<Harness />);
    const { input } = openPalette();
    const options = screen.getAllByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", options[0]?.id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options[1]?.id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveAttribute("aria-activedescendant", options[0]?.id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveAttribute("aria-activedescendant", options[2]?.id);
    await vi.waitFor(() => expect(input).toHaveFocus());
  });

  it("opens the active option on Enter, then closes and returns focus to what opened it", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const { trigger, input } = openPalette();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "29" }));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on Escape and gives focus back", async () => {
    render(<Harness />);
    const { trigger, input } = openPalette();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(trigger).toHaveFocus());
  });

  it("says when nothing matches, and announces it", () => {
    render(<Harness groups={[]} query="Hockney" />);
    openPalette();
    expect(screen.getByText('No results for "Hockney"')).toBeInTheDocument();
    expect(screen.getByText("No results for Hockney")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("shows the account's own empty state before anything exists", () => {
    render(
      <Harness
        groups={[]}
        emptyState={{
          title: "Search Cedar & Stone Fine Art",
          description: "Nothing yet? Start by selling a work.",
        }}
      />,
    );
    openPalette();
    expect(screen.getByText("Nothing yet? Start by selling a work.")).toBeInTheDocument();
  });

  it("marks the list busy while results load", () => {
    render(<Harness status="loading" />);
    openPalette();
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
  });
});

function ShortcutProbe({ onOpen }: { onOpen: () => void }) {
  useSearchPaletteShortcut(onOpen);
  return <input aria-label="Notes" />;
}

describe("useSearchPaletteShortcut", () => {
  it("opens on ⌘K and Ctrl K anywhere, and on / outside a field", () => {
    const onOpen = vi.fn();
    render(<ShortcutProbe onOpen={onOpen} />);
    act(() => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      fireEvent.keyDown(document.body, { key: "/" });
    });
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("leaves / to a field someone is typing in", () => {
    const onOpen = vi.fn();
    render(<ShortcutProbe onOpen={onOpen} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), { key: "/" });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
