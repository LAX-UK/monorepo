import { describe, expect, it, vi } from "vitest";
import { UNKEYED_NOTICE, addErrorNoticeBreadcrumb } from "./notice-breadcrumb";

describe("addErrorNoticeBreadcrumb", () => {
  it("records the notice key as a ui.notice error breadcrumb", () => {
    const addBreadcrumb = vi.fn();
    addErrorNoticeBreadcrumb("bid-failed", { addBreadcrumb });
    expect(addBreadcrumb).toHaveBeenCalledExactlyOnceWith({
      category: "ui.notice",
      level: "error",
      message: "bid-failed",
    });
  });

  it("falls back to a fixed label when there is no key", () => {
    const addBreadcrumb = vi.fn();
    addErrorNoticeBreadcrumb(undefined, { addBreadcrumb });
    expect(addBreadcrumb.mock.calls[0]?.[0].message).toBe(UNKEYED_NOTICE);
  });

  it("does nothing when Sentry is absent", () => {
    expect(() => addErrorNoticeBreadcrumb("k", {})).not.toThrow();
  });

  it("swallows a failing sink", () => {
    const addBreadcrumb = vi.fn(() => {
      throw new Error("boom");
    });
    expect(() => addErrorNoticeBreadcrumb("k", { addBreadcrumb })).not.toThrow();
  });
});
