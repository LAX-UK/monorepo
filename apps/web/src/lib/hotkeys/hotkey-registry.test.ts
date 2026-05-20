import { describe, expect, it, vi } from "vitest";
import {
  getActiveHotkeyScope,
  popHotkeyScope,
  pushHotkeyScope,
  registerHotkey,
  resetHotkeyRegistryForTests,
} from "./hotkey-registry";

describe("hotkey-registry", () => {
  it("push/pop scope stack", () => {
    resetHotkeyRegistryForTests();
    expect(getActiveHotkeyScope()).toBe("global");
    pushHotkeyScope("table");
    expect(getActiveHotkeyScope()).toBe("table");
    popHotkeyScope("table");
    expect(getActiveHotkeyScope()).toBe("global");
  });

  it("warns on duplicate keys in the same scope", () => {
    resetHotkeyRegistryForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerHotkey({
      id: "go-lots",
      keys: "g l",
      label: "Lots",
      scope: "global",
      group: "Navigation",
      handler: () => {},
    });
    registerHotkey({
      id: "go-sales",
      keys: "g l",
      label: "Sales",
      scope: "global",
      group: "Navigation",
      handler: () => {},
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Hotkey conflict"));
    warn.mockRestore();
  });
});
