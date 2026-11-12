import { ZOHO_TOKEN_FAILING_STREAK } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { createTestZohoSyncHealth } from "../../test-app-deps.js";
import { TOKEN_STALE_AFTER_MS, tokenStatus } from "./zoho-sync-health.service.js";

const NOW = new Date("2026-11-11T12:00:00.000Z");
const HOUR = 3_600_000;
const token = (overrides: Partial<Parameters<typeof tokenStatus>[0]> = {}) => ({
  refreshedAt: new Date(NOW.getTime() - HOUR),
  expiresAt: new Date(NOW.getTime() + HOUR),
  failureStreak: 0,
  lastFailureAt: null,
  ...overrides,
});

describe("token status", () => {
  it("is unknown before any refresh", () => {
    expect(tokenStatus(token({ refreshedAt: null, expiresAt: null }), true, NOW)).toBe("unknown");
  });

  it("is ok after a recent refresh", () => {
    expect(tokenStatus(token(), true, NOW)).toBe("ok");
  });

  it("warns after one failure and fails after two in a row", () => {
    expect(tokenStatus(token({ failureStreak: 1 }), true, NOW)).toBe("warning");
    expect(tokenStatus(token({ failureStreak: ZOHO_TOKEN_FAILING_STREAK }), true, NOW)).toBe(
      "failing",
    );
  });

  it("warns when a running sync has not refreshed for a day, but not when it is off", () => {
    const stale = token({ refreshedAt: new Date(NOW.getTime() - TOKEN_STALE_AFTER_MS - 1) });
    expect(tokenStatus(stale, true, NOW)).toBe("warning");
    expect(tokenStatus(stale, false, NOW)).toBe("ok");
  });
});

describe("Sync health summary", () => {
  it("reports Zoho off until the worker reports a mode, and when every mode is off", async () => {
    expect((await createTestZohoSyncHealth().summary()).zohoOff).toBe(true);
    const off = createTestZohoSyncHealth({
      health: {
        read: async () => ({
          modes: { artworkSync: "off", listing: "off" },
          modesReportedAt: NOW,
          token: { refreshedAt: null, expiresAt: null, failureStreak: 0, lastFailureAt: null },
        }),
      },
    });
    expect((await off.summary()).zohoOff).toBe(true);
  });

  it("brings every figure together", async () => {
    const service = createTestZohoSyncHealth({
      now: () => NOW,
      health: {
        read: async () => ({
          modes: { artworkSync: "live", listing: "dry_run" },
          modesReportedAt: NOW,
          token: {
            refreshedAt: new Date(NOW.getTime() - HOUR),
            expiresAt: new Date(NOW.getTime() + HOUR),
            failureStreak: 0,
            lastFailureAt: null,
          },
        }),
      },
      inboundRuns: {
        latestNightlyRun: async () => ({
          mode: "live",
          finishedAt: NOW,
          total: 120,
          byOutcome: { create: 2, update: 3, conflict: 1, unchanged: 100, stale: 0, skipped: 14 },
          skippedReasons: [
            { reason: "demo_artist", count: 10 },
            { reason: "missing_title", count: 4 },
          ],
          gaps: [],
        }),
      },
      listingRuns: {
        latestRun: async () => ({
          mode: "dry_run",
          finishedAt: NOW,
          checked: 80,
          changed: 5,
          unchanged: 74,
          failed: 1,
          failures: [],
        }),
      },
      outbound: {
        stats: async () => ({
          depth: 7,
          oldestPendingAt: new Date(NOW.getTime() - 2 * HOUR),
          deadLettered: 2,
        }),
      },
    });
    expect(await service.summary()).toEqual({
      modes: { artworkSync: "live", listing: "dry_run", reportedAt: NOW.toISOString() },
      zohoOff: false,
      inbound: {
        run: {
          mode: "live",
          finishedAt: NOW.toISOString(),
          seen: 120,
          changed: 5,
          leftOut: 4,
          conflicts: 1,
        },
      },
      listing: {
        run: { mode: "dry_run", finishedAt: NOW.toISOString(), checked: 80, drift: 5, failed: 1 },
      },
      outbound: {
        depth: 7,
        oldestPendingAt: new Date(NOW.getTime() - 2 * HOUR).toISOString(),
        deadLettered: 2,
      },
      token: {
        status: "ok",
        refreshedAt: new Date(NOW.getTime() - HOUR).toISOString(),
        expiresAt: new Date(NOW.getTime() + HOUR).toISOString(),
        failureStreak: 0,
        lastFailureAt: null,
      },
      drift: { registerWithoutProduct: 0, productsWithoutRegister: 0, statusMismatch: 0 },
    });
  });

  it("turns a page number into limit and offset and words for the place", async () => {
    const seen: unknown[] = [];
    const service = createTestZohoSyncHealth({
      drift: {
        counts: async () => ({
          registerWithoutProduct: 0,
          productsWithoutRegister: 0,
          statusMismatches: 30,
        }),
        registerWithoutProduct: async () => ({ rows: [], total: 0 }),
        productsWithoutRegister: async () => ({ rows: [], total: 0 }),
        statusMismatches: async (paging) => {
          seen.push(paging);
          return {
            rows: [
              {
                registerId: "44444444-4444-4444-8444-444444444444",
                stockCode: "LAX-ORI-PH-GAC-26-0002",
                title: "Quay",
                artistName: "A. Painter",
                offerState: "sold" as const,
                zohoStatus: "Available",
                expectedStatus: "Sold",
              },
            ],
            total: 30,
          };
        },
      },
    });
    const page = await service.statusMismatches({ page: 2 });
    expect(seen).toEqual([{ limit: 25, offset: 25 }]);
    expect(page).toMatchObject({ total: 30, page: 2, pageSize: 25 });
    expect(page.items[0]).toMatchObject({ place: "Sold", zohoStatus: "Available" });
  });
});
