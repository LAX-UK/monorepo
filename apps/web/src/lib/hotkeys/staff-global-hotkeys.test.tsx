import { openCommandPalette } from "@/components/layout/command-palette-events";
import { HotkeyProvider } from "@/lib/hotkeys/hotkey-provider";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
