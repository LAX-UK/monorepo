import type { AdminArtistListRow, AdminArtistStats } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  ARTISTS_DEFAULT_SORT,
  artistsActiveLens,
  artistsAttention,
  artistsFilterChips,
  artistsQueue,
  artistsRangeSummary,
  artistsSortHref,
  artistsSortState,
  artistsViews,
  lotCountLabel,
  toArtistsStaffRows,
} from "./artists-staff-list.vm";
import { countryName } from "./country-options";

const row = {
  id: "artist_1",
  displayName: "Ada Lovelace",
  portraitUrl: null,
  status: "pending",
  kind: "artist",
  birthYear: "1920",
  deathYear: "1999",
  lotCount: 1,
  aliasCount: 0,
  ownerDisplayName: "  ",
  featured: true,
  verified: false,
  archived: false,
  updatedAt: "2026-10-20T10:00:00.000Z",
} as unknown as AdminArtistListRow;

const stats = { total: 312, pendingReview: 3, makerSellers: 12, featured: 8 } as AdminArtistStats;

describe("artists staff list view model", () => {
  it("names the status and kind in words and flags a featured artist", () => {
    const [artist] = toArtistsStaffRows([row]);
    expect(artist?.status).toEqual({ label: "Pending review", tone: "warning" });
    expect(artist?.owner).toBeNull();
    expect(artist?.flags.map((flag) => flag.label)).toEqual(["Featured"]);
    expect(artist?.publicHref).toBeNull();
    expect(lotCountLabel(1)).toBe("1 lot");
  });

  it("counts each lens from the stats and finds the lens in force", () => {
    const views = artistsViews({}, stats);
    expect(views.find((view) => view.id === "pending")?.count).toBe(3);
    expect(views.find((view) => view.id === "archived")?.count).toBeUndefined();
    expect(artistsActiveLens({ status: "pending" })).toBe("pending");
    expect(artistsActiveLens({ archivedOnly: true, status: "pending" })).toBe("archived");
  });

  it("words the waiting work with the right plural", () => {
    const [pending, backfill] = artistsAttention({}, { pendingReview: 1, backfillTasks: 4 });
    expect(pending?.label).toBe("artist is waiting for review");
    expect(backfill?.label).toBe("lot artist backfill tasks need review");
    expect(backfill?.href).toBe("/admin/artists?backfill=1");
  });

  it("does not repeat the tab's own filter as a chip", () => {
    const chips = artistsFilterChips({}, { status: "pending", country: "fr" }, null);
    expect(chips.map((chip) => chip.label)).toEqual(["Country: France"]);
    expect(countryName("gb")).toBe("United Kingdom");
  });

  it("sends the review queues to their own pages", () => {
    expect(artistsQueue({ duplicates: "1" })).toBe("duplicates");
    expect(artistsQueue({})).toBeNull();
  });

  it("always shows a sort and counts the range", () => {
    expect(artistsSortState(undefined)).toEqual(ARTISTS_DEFAULT_SORT);
    expect(artistsSortHref({}, { columnId: "lots", direction: "desc" })).toBe(
      "/admin/artists?sort=popular",
    );
    expect(artistsRangeSummary(0, 1, 1)).toBe("1–1 of 1 artist");
  });
});
