import { describe, expect, it } from "vitest";
import {
  formatSettlementsContactLine,
  settlementsEmail,
  settlementsEmailDisplay,
  settlementsPhone,
} from "./settlements-contact";

describe("settlements-contact", () => {
  it("avoids fake placeholder email when env is unset", () => {
    expect(settlementsEmailDisplay()).not.toContain("example.com");
  });

  it("hides phone when env is unset", () => {
    expect(settlementsPhone()).toBeNull();
  });

  it("formats contact line without placeholder values", () => {
    expect(formatSettlementsContactLine()).not.toContain("+1 (000)");
    expect(formatSettlementsContactLine()).not.toContain("example.com");
  });

  it("returns null email when env is unset", () => {
    expect(settlementsEmail()).toBeNull();
  });
});
