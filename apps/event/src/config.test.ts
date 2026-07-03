// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_EVENT_SLUG, resolveEventSlug } from "./config.js";

describe("resolveEventSlug", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null at bare root without build override", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/", search: "" },
      writable: true,
    });
    expect(resolveEventSlug()).toBeNull();
  });

  it("returns slug from /events/:slug paths", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/events/lax002", search: "" },
      writable: true,
    });
    expect(resolveEventSlug()).toBe("lax002");
  });

  it("returns slug from /:slug paths", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/lax002", search: "" },
      writable: true,
    });
    expect(resolveEventSlug()).toBe("lax002");
  });

  it("returns slug from /:slug/pass/:token paths", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/lax002/pass/abc123token456789", search: "" },
      writable: true,
    });
    expect(resolveEventSlug()).toBe("lax002");
  });

  it("returns null for legacy /pass/:token without slug prefix", () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/pass/abc123token456789", search: "" },
      writable: true,
    });
    expect(resolveEventSlug()).toBeNull();
  });

  it("uses VITE_EVENT_SLUG override when set", () => {
    vi.stubEnv("VITE_EVENT_SLUG", "staging-event");
    Object.defineProperty(window, "location", {
      value: { pathname: "/", search: "" },
      writable: true,
    });
    expect(resolveEventSlug()).toBe("staging-event");
  });

  it("keeps DEFAULT_EVENT_SLUG export for legacy asset fallbacks", () => {
    expect(DEFAULT_EVENT_SLUG).toBe("lax001");
  });
});
