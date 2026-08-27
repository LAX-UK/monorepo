import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatSettlementsContactLine,
  settlementsEmail,
  settlementsEmailDisplay,
  settlementsPhone,
} from "./settlements-contact";

describe("settlements-contact", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SETTLEMENTS_EMAIL", "");
    vi.stubEnv("NEXT_PUBLIC_SETTLEMENTS_PHONE", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("uses configured settlements contact details", () => {
    vi.stubEnv("NEXT_PUBLIC_SETTLEMENTS_EMAIL", "settlements@lax.test");
    vi.stubEnv("NEXT_PUBLIC_SETTLEMENTS_PHONE", "+44 20 7946 0958");

    expect(formatSettlementsContactLine()).toBe("settlements@lax.test · +44 20 7946 0958");
  });
});
