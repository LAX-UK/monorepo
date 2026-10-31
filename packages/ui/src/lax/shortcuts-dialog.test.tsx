import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { KeyboardShortcutsDialog, ShortcutKeys } from "./index.js";

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
