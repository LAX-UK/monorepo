import { openCommandPalette } from "@/components/layout/command-palette-events";
import { HotkeyProvider } from "@/lib/hotkeys/hotkey-provider";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetHotkeyRegistryForTests } from "./hotkey-registry";
import { StaffGlobalHotkeys } from "./staff-global-hotkeys";

vi.mock("@/components/layout/command-palette-events", () => ({
  openCommandPalette: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("StaffGlobalHotkeys", () => {
  afterEach(() => {
    vi.clearAllMocks();
    resetHotkeyRegistryForTests();
  });

  it("opens the command palette on mod+k", () => {
    render(
      <HotkeyProvider scope="page">
        <StaffGlobalHotkeys />
      </HotkeyProvider>,
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );

    expect(openCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("opens the shortcut list with ?, showing ? as one key and no capitals", () => {
    render(
      <HotkeyProvider scope="page">
        <StaffGlobalHotkeys />
      </HotkeyProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: "?", code: "Slash", shiftKey: true });
    });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const row = within(dialog).getByText("Show keyboard shortcuts").closest("li") as HTMLElement;
    const caps = [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent);
    expect(caps).toEqual(["?"]);
    expect(dialog.textContent).not.toMatch(/SHIFT/);
  });
});
