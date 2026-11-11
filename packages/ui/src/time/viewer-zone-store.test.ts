// @vitest-environment jsdom
process.env.TZ = "Europe/London";

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccountViewerZone,
  getAccountViewerZoneSnapshot,
  reconcileAccountViewerZone,
  setAccountViewerZone,
  subscribeViewerZone,
} from "./viewer-zone-store.js";

describe("the account zone override", () => {
  beforeEach(() => clearAccountViewerZone());

  it("tells every chip when it is cleared, and stays quiet when there is nothing to clear", () => {
    const onChange = vi.fn();
    const stop = subscribeViewerZone(onChange);
    clearAccountViewerZone();
    expect(onChange).not.toHaveBeenCalled();
    setAccountViewerZone({ mode: "fixed", zone: "Asia/Tokyo" });
    onChange.mockClear();
    clearAccountViewerZone();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(getAccountViewerZoneSnapshot()).toBeNull();
    stop();
  });

  it("keeps a saved city until the server's copy says the same", () => {
    setAccountViewerZone({ mode: "fixed", zone: "Asia/Tokyo" });
    reconcileAccountViewerZone({ mode: "fixed", zone: "Europe/London" });
    expect(getAccountViewerZoneSnapshot()).not.toBeNull();
    reconcileAccountViewerZone({ mode: "fixed", zone: "Asia/Tokyo" });
    expect(getAccountViewerZoneSnapshot()).toBeNull();
  });

  it("drops it on sign-out", () => {
    setAccountViewerZone({ mode: "fixed", zone: "Asia/Tokyo" });
    reconcileAccountViewerZone(null);
    expect(getAccountViewerZoneSnapshot()).toBeNull();
  });

  it("drops an Automatic choice once the server holds the device's zone", () => {
    setAccountViewerZone({ mode: "automatic", zone: null });
    reconcileAccountViewerZone({ mode: "automatic", zone: "Asia/Tokyo" });
    expect(getAccountViewerZoneSnapshot()).not.toBeNull();
    reconcileAccountViewerZone({ mode: "automatic", zone: "Europe/London" });
    expect(getAccountViewerZoneSnapshot()).toBeNull();
  });
});
