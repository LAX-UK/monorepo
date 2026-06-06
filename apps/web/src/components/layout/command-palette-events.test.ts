import { afterEach, describe, expect, it } from "vitest";
import {
  clearPendingPaletteOpen,
  openCommandPalette,
  takePendingPaletteOpen,
} from "./command-palette-events";

describe("command-palette-events", () => {
  afterEach(() => {
    clearPendingPaletteOpen();
  });

  it("sets pending open when palette is requested before mount", () => {
    openCommandPalette();
    expect(takePendingPaletteOpen()).toBe(true);
    expect(takePendingPaletteOpen()).toBe(false);
  });
});
