import type {
  ArtistWatchlistRow,
  IArtistWatchlistRepository,
} from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ArtistWatchlistService } from "./artist-watchlist.service.js";
import { UserWatchlistHttpApplicationService } from "./user/user-watchlist-http-application.service.js";

const followed: ArtistWatchlistRow = {
  id: "w1",
  userId: "u1",
  artistId: "a1",
  createdAt: new Date("2026-11-01T00:00:00Z"),
  alert: { medium: null, priceMin: null, priceMax: null },
};

function build(following: boolean) {
  const repo = {
    setAlert: vi.fn(async (_u: string, _a: string, alert: ArtistWatchlistRow["alert"]) =>
      following ? { ...followed, alert } : null,
    ),
    findByUser: vi.fn(async () => [followed]),
  } as unknown as IArtistWatchlistRepository;
  const service = new ArtistWatchlistService(repo, { findById: vi.fn() } as never);
  const http = new UserWatchlistHttpApplicationService({
    artistWatchlistService: service,
  } as never);
  return { repo, http };
}

describe("artist alert criteria", () => {
  it("saves criteria for a followed artist", async () => {
    const { http } = build(true);
    const alert = { medium: "oil", priceMin: "1000", priceMax: "5000" };
    const res = await http.setArtistAlert({ userId: "u1", artistId: "a1", criteria: alert });
    expect(res).toEqual({ status: 200, body: { data: { artistId: "a1", alert } } });
  });

  it("refuses an inverted price range without touching storage", async () => {
    const { http, repo } = build(true);
    const res = await http.setArtistAlert({
      userId: "u1",
      artistId: "a1",
      criteria: { medium: null, priceMin: "9000", priceMax: "100" },
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "alert_price_range_inverted" });
    expect(repo.setAlert).not.toHaveBeenCalled();
  });

  it("says to follow the artist first", async () => {
    const { http } = build(false);
    const res = await http.setArtistAlert({
      userId: "u1",
      artistId: "a1",
      criteria: { medium: null, priceMin: null, priceMax: null },
    });
    expect(res).toMatchObject({ status: 404, body: { code: "artist_not_followed" } });
  });

  it("lists each followed artist with its alert", async () => {
    const { http } = build(true);
    const res = await http.listArtistWatchlist({ userId: "u1" });
    expect(res.body).toMatchObject({ data: [{ artistId: "a1", alert: followed.alert }] });
  });
});
