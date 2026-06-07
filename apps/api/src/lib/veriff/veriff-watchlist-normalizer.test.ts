import { describe, expect, it } from "vitest";
import {
  VERIFF_WATCHLIST_MATCH_FOUND,
  VERIFF_WATCHLIST_MONITORING_UPDATE,
  VERIFF_WATCHLIST_NO_MATCH,
} from "./veriff-watchlist-fixtures.js";
import { normalizeVeriffWatchlistWebhook } from "./veriff-watchlist-normalizer.js";
import { veriffWatchlistWebhookSchema } from "./veriff-watchlist-types.js";

describe("normalizeVeriffWatchlistWebhook", () => {
  it("reads sessionId and vendorData from data.* (documented shape)", () => {
    const parsed = veriffWatchlistWebhookSchema.parse(VERIFF_WATCHLIST_MATCH_FOUND);
    const normalized = normalizeVeriffWatchlistWebhook(parsed);

    expect(normalized.providerSessionId).toBe("f04bdb47-d3be-4b28-b028-a652feb060b5");
    expect(normalized.userId).toBe("user_test_123");
    expect(normalized.checkType).toBe("initial_result");
    expect(normalized.result.matchStatus).toBe("possible_match");
    expect(normalized.result.monitorStatus).toBe("monitored");
    expect(normalized.result.totalHits).toBe(1);
  });

  it("derives PEP, sanctions, and adverse_media categories from listingsRelatedToMatch", () => {
    const parsed = veriffWatchlistWebhookSchema.parse(VERIFF_WATCHLIST_MATCH_FOUND);
    const normalized = normalizeVeriffWatchlistWebhook(parsed);

    expect(normalized.result.categories).toEqual(
      expect.arrayContaining(["sanction", "pep", "adverse_media"]),
    );
    expect(normalized.result.hits[0]?.matchedName).toContain("Kadhafi");
    expect(normalized.result.hits[0]?.listings.pep?.[0]?.sourceName).toBe(
      "ComplyAdvantage PEP data",
    );
    expect(normalized.result.hits[0]?.listings.adverse_media?.[0]?.snippet).toContain("Gaddafi");
  });

  it("clears no_match screenings with empty hits", () => {
    const parsed = veriffWatchlistWebhookSchema.parse(VERIFF_WATCHLIST_NO_MATCH);
    const normalized = normalizeVeriffWatchlistWebhook(parsed);

    expect(normalized.result.matchStatus).toBe("no_match");
    expect(normalized.result.totalHits).toBe(0);
    expect(normalized.result.hits).toHaveLength(0);
  });

  it("handles ongoing monitoring updated_result payloads", () => {
    const parsed = veriffWatchlistWebhookSchema.parse(VERIFF_WATCHLIST_MONITORING_UPDATE);
    const normalized = normalizeVeriffWatchlistWebhook(parsed);

    expect(normalized.checkType).toBe("updated_result");
    expect(normalized.result.categories).toEqual(expect.arrayContaining(["pep", "adverse_media"]));
  });
});
