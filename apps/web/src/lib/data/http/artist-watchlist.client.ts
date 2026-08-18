export interface ArtistWatchlistClient {
  follow(artistId: string): Promise<boolean>;
  unfollow(artistId: string): Promise<boolean>;
}

function browserApiBase(): string {
  return "/api/bff";
}

export const defaultArtistWatchlistClient: ArtistWatchlistClient = {
  async unfollow(artistId) {
    const res = await fetch(
      `${browserApiBase()}/users/me/artist-watchlist/${encodeURIComponent(artistId)}`,
      { method: "DELETE", credentials: "include" },
    );
    return res.ok;
  },
  async follow(artistId) {
    const res = await fetch(`${browserApiBase()}/users/me/artist-watchlist`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artistId }),
    });
    return res.ok;
  },
};
