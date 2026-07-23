// @vitest-environment jsdom

import { useConsent } from "@/lib/analytics/consent/context";
import { isMarketingAttributionEnabled } from "@/lib/analytics/is-marketing-attribution-enabled";
import {
  captureInitialDocumentTouch,
  clearAttributionCookie,
  readAttributionCookie,
  writeAttributionCookie,
} from "@/lib/analytics/marketing-attribution-cookie";
import {
  deleteMarketingAttribution,
  syncMarketingAttribution,
} from "@/lib/data/http/marketing-attribution.client";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingAttributionSync } from "./marketing-attribution-sync";

vi.mock("@/lib/analytics/consent/context", () => ({ useConsent: vi.fn() }));
vi.mock("@/lib/analytics/is-marketing-attribution-enabled", () => ({
  isMarketingAttributionEnabled: vi.fn(),
}));
vi.mock("@/lib/analytics/marketing-attribution-cookie", () => ({
  captureInitialDocumentTouch: vi.fn(),
  clearAttributionCookie: vi.fn(),
  readAttributionCookie: vi.fn(),
  writeAttributionCookie: vi.fn(),
}));
vi.mock("@/lib/data/http/marketing-attribution.client", () => ({
  deleteMarketingAttribution: vi.fn().mockResolvedValue(undefined),
  syncMarketingAttribution: vi.fn().mockResolvedValue(undefined),
}));

function consentValue(marketing: boolean, analytics: boolean): ReturnType<typeof useConsent> {
  return {
    snapshot: {
      v: 1,
      ts: "2026-01-01T00:00:00.000Z",
      necessary: true,
      analytics,
      marketing,
    },
    showBanner: false,
    preferencesOpen: false,
    openPreferences: vi.fn(),
    closePreferences: vi.fn(),
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    saveCustom: vi.fn(),
    dismissBanner: vi.fn(),
  };
}

describe("MarketingAttributionSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(isMarketingAttributionEnabled).mockReturnValue(true);
    vi.mocked(captureInitialDocumentTouch).mockReturnValue(null);
    vi.mocked(readAttributionCookie).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("clears stale browser and server attribution when consent is denied", async () => {
    vi.mocked(useConsent).mockReturnValue(consentValue(false, true));
    vi.mocked(readAttributionCookie).mockReturnValue({
      version: 1,
      lastTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: "/campaign",
        utmSource: "newsletter",
      },
    });

    render(<MarketingAttributionSync />);
    await act(async () => vi.runAllTimersAsync());

    expect(clearAttributionCookie).toHaveBeenCalledOnce();
    expect(deleteMarketingAttribution).toHaveBeenCalledOnce();
  });

  it("does not issue deletion traffic for visitors without stored attribution", async () => {
    vi.mocked(useConsent).mockReturnValue(consentValue(false, false));

    render(<MarketingAttributionSync />);
    await act(async () => vi.runAllTimersAsync());

    expect(clearAttributionCookie).toHaveBeenCalledOnce();
    expect(deleteMarketingAttribution).not.toHaveBeenCalled();
  });

  it("cleans up existing attribution when the kill switch is off", async () => {
    vi.mocked(isMarketingAttributionEnabled).mockReturnValue(false);
    vi.mocked(useConsent).mockReturnValue(consentValue(true, true));
    vi.mocked(readAttributionCookie).mockReturnValue({
      version: 1,
      lastTouch: {
        capturedAt: "2026-01-01T00:00:00.000Z",
        landingPath: "/campaign",
      },
    });

    render(<MarketingAttributionSync />);
    await act(async () => vi.runAllTimersAsync());

    expect(clearAttributionCookie).toHaveBeenCalledOnce();
    expect(deleteMarketingAttribution).toHaveBeenCalledOnce();
    expect(captureInitialDocumentTouch).not.toHaveBeenCalled();
  });

  it("persists and syncs the initial campaign after marketing consent", async () => {
    const touch = {
      capturedAt: "2026-01-01T00:00:00.000Z",
      landingPath: "/campaign",
      utmSource: "newsletter",
    };
    vi.mocked(useConsent).mockReturnValue(consentValue(true, true));
    vi.mocked(captureInitialDocumentTouch).mockReturnValue(touch);

    render(<MarketingAttributionSync />);
    await act(async () => vi.runAllTimersAsync());

    expect(writeAttributionCookie).toHaveBeenCalledWith({
      version: 1,
      firstTouch: touch,
      lastTouch: touch,
    });
    expect(syncMarketingAttribution).toHaveBeenCalledOnce();
  });
});
