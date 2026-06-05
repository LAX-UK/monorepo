import {
  notifyMarketingViewUrlChanged,
  readMarketingViewParam,
  replaceMarketingViewUrl,
  resetMarketingViewClientState,
  subscribeMarketingViewUrl,
} from "@/lib/preferences/view-url-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("view-url-store", () => {
  beforeEach(() => {
    resetMarketingViewClientState();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    resetMarketingViewClientState();
    window.history.replaceState({}, "", "/");
  });

  it("reads view param with default fallback", () => {
    window.history.replaceState({}, "", "/search?view=list");
    expect(readMarketingViewParam("grid")).toBe("list");
    expect(readMarketingViewParam("grid")).toBe("list");
  });

  it("returns default when view param is absent", () => {
    expect(readMarketingViewParam("grid")).toBe("grid");
  });

  it("falls back to server view when URL omits the param", () => {
    expect(readMarketingViewParam("grid", "list")).toBe("list");
  });

  it("replaceMarketingViewUrl updates location and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMarketingViewUrl(listener);

    replaceMarketingViewUrl("/sales?view=calendar", "calendar");

    expect(window.location.pathname).toBe("/sales");
    expect(window.location.search).toBe("?view=calendar");
    expect(readMarketingViewParam("grid")).toBe("calendar");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyMarketingViewUrlChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tracks canonical default view after client navigation", () => {
    replaceMarketingViewUrl("/search", "grid");
    expect(readMarketingViewParam("grid", "list")).toBe("grid");
  });
});
