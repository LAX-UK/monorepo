import { openCommandPalette } from "@/components/layout/command-palette-events";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCommandPaletteHotkey } from "./use-command-palette-hotkey";

vi.mock("@/components/layout/command-palette-events", () => ({
  openCommandPalette: vi.fn(),
}));

describe("useCommandPaletteHotkey", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the command palette on mod+k", () => {
    renderHook(() => useCommandPaletteHotkey());

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );

    expect(openCommandPalette).toHaveBeenCalledTimes(1);
  });

  it("ignores mod+k when focus is in an input", () => {
    renderHook(() => useCommandPaletteHotkey());

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));

    expect(openCommandPalette).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});
