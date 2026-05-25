import { openCommandPalette } from "@/components/layout/command-palette-events";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketingGlobalHotkeys } from "./marketing-global-hotkeys";

vi.mock("@/components/layout/command-palette-events", () => ({
  openCommandPalette: vi.fn(),
}));

describe("MarketingGlobalHotkeys", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the command palette on mod+k", () => {
    render(<MarketingGlobalHotkeys />);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );

    expect(openCommandPalette).toHaveBeenCalledTimes(1);
  });
});
