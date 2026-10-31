import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientGlobalHotkeys } from "./client-global-hotkeys";
import { ClientHotkeyHelpDialog } from "./client-hotkey-help-dialog";
import { HotkeyProvider } from "./hotkey-provider";
import { resetHotkeyRegistryForTests } from "./hotkey-registry";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function key(init: KeyboardEventInit, target: Window | HTMLElement = window) {
  act(() => {
    fireEvent.keyDown(target, init);
  });
}

function renderShell(pages: { id: string; href: string }[]) {
  return render(
    <HotkeyProvider scope="page" renderHelp={(p) => <ClientHotkeyHelpDialog {...p} />}>
      <ClientGlobalHotkeys pages={pages} />
      <input aria-label="Notes" />
    </HotkeyProvider>,
  );
}

afterEach(() => {
  push.mockReset();
  resetHotkeyRegistryForTests();
});

describe("ClientGlobalHotkeys", () => {
  it("goes to a page the menu holds with its g key", () => {
    renderShell([
      { id: "home", href: "/home" },
      { id: "bids", href: "/bids" },
    ]);
    key({ key: "g", code: "KeyG" });
    key({ key: "b", code: "KeyB" });
    expect(push).toHaveBeenCalledWith("/bids");
  });

  it("never offers a page the role cannot open", () => {
    renderShell([{ id: "home", href: "/home" }]);
    key({ key: "g", code: "KeyG" });
    key({ key: "t", code: "KeyT" });
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores keys typed into a field", () => {
    renderShell([{ id: "bids", href: "/bids" }]);
    const field = screen.getByRole("textbox", { name: "Notes" });
    key({ key: "g", code: "KeyG" }, field);
    key({ key: "b", code: "KeyB" }, field);
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the shortcut list with ?, in the approved order, with only the person's pages", () => {
    renderShell([
      { id: "home", href: "/home" },
      { id: "consignments", href: "/selling/consignments" },
    ]);
    key({ key: "?", code: "Slash", shiftKey: true });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const anywhere = within(dialog).getByRole("region", { name: "Anywhere" });
    expect(
      within(anywhere)
        .getAllByRole("listitem")
        .map((li) => li.firstChild?.textContent),
    ).toEqual(["Search", "Show shortcuts", "Home", "Consignments"]);
    const lists = within(dialog).getByRole("region", { name: "In lists" });
    expect(
      within(lists)
        .getAllByRole("listitem")
        .map((li) => li.firstChild?.textContent),
    ).toEqual([
      "Next and previous row",
      "Open",
      "Select (where lists allow it)",
      "Close a panel or dialog",
    ]);
    expect(
      within(dialog).getByText(/The same keys as LAX Admin and Bid admin/),
    ).toBeInTheDocument();
  });
});
