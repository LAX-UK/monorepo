import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeyboardShortcutsDialog, ShortcutKeys, shortcutKeyCaps } from "./index.js";

describe("KeyboardShortcutsDialog", () => {
  it("lists each group's actions with their keys, alternatives read with or", () => {
    render(
      <KeyboardShortcutsDialog
        open
        onOpenChange={() => {}}
        note="Shortcuts are optional; every action also has a button."
        groups={[
          {
            id: "anywhere",
            label: "Anywhere",
            items: [
              { id: "search", label: "Search", keys: ["mod+k", "/"] },
              { id: "home", label: "Home", keys: ["g h"] },
            ],
          },
          { id: "empty", label: "Nothing here", items: [] },
        ]}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const group = within(dialog).getByRole("region", { name: "Anywhere" });
    const search = within(group).getByText("Search").closest("li") as HTMLElement;
    expect(within(search).getByText("or")).toBeInTheDocument();
    expect(within(search).getByText("/")).toBeInTheDocument();
    // A sequence shows its key caps side by side, without "then".
    const home = within(group).getByText("Home").closest("li") as HTMLElement;
    expect(within(home).getByText("G")).toBeInTheDocument();
    expect(within(home).getByText("H")).toBeInTheDocument();
    expect(within(home).queryByText("then")).not.toBeInTheDocument();
    // A group with no shortcuts is left out.
    expect(within(dialog).queryByText("Nothing here")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/every action also has a button/)).toBeInTheDocument();
  });
});

describe("ShortcutKeys", () => {
  it("reads a sequence with then by default", () => {
    render(<ShortcutKeys keys="g o" />);
    expect(screen.getByText("then")).toBeInTheDocument();
  });
});

describe("shortcutKeyCaps", () => {
  it("shows ? as one key, with Shift implied by the symbol", () => {
    expect(shortcutKeyCaps("?")).toEqual([["?"]]);
    expect(shortcutKeyCaps("shift+?")).toEqual([["?"]]);
    expect(shortcutKeyCaps("Shift+?")).toEqual([["?"]]);
  });

  it("reads modifiers and named keys in sentence case, never in capitals", () => {
    expect(shortcutKeyCaps("shift+j")).toEqual([["Shift", "J"]]);
    expect(shortcutKeyCaps("SHIFT+J")).toEqual([["Shift", "J"]]);
    expect(shortcutKeyCaps("escape")).toEqual([["Esc"]]);
    expect(shortcutKeyCaps("Enter")).toEqual([["↵"]]);
    expect(shortcutKeyCaps("tab")).toEqual([["Tab"]]);
  });

  it("shows ⌘ on a Mac and Ctrl elsewhere, in both syntaxes", () => {
    expect(shortcutKeyCaps("mod+k")).toEqual([["⌘", "K"]]);
    expect(shortcutKeyCaps("$mod+k")).toEqual([["⌘", "K"]]);
    expect(shortcutKeyCaps("mod+k", { mac: false })).toEqual([["Ctrl", "K"]]);
  });

  it("splits a sequence into steps, and keeps + as a key", () => {
    expect(shortcutKeyCaps("g h")).toEqual([["G"], ["H"]]);
    expect(shortcutKeyCaps("mod++")).toEqual([["⌘", "+"]]);
  });
});
