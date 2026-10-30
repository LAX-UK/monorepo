import type { ArtistAlertCriteria } from "@auction/domain";

/** Why saving an alert was refused, in words the person can act on. */
export type ArtistAlertSaveResult =
  | { ok: true; alert: ArtistAlertCriteria }
  | { ok: false; message: string };

export interface ArtistWatchlistClient {
  follow(artistId: string): Promise<boolean>;
  unfollow(artistId: string): Promise<boolean>;
}

/** The alert on a followed artist; apart from following, so a toggle depends on less. */
export interface ArtistAlertClient {
  /** Replaces what the person hears about for an artist they follow. */
  setAlert(artistId: string, criteria: ArtistAlertCriteria): Promise<ArtistAlertSaveResult>;
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

export const defaultArtistAlertClient: ArtistAlertClient = {
  async setAlert(artistId, criteria) {
    try {
      const res = await fetch(
        `${browserApiBase()}/users/me/artist-watchlist/${encodeURIComponent(artistId)}/alert`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(criteria),
        },
      );
      const body = (await res.json().catch(() => null)) as {
        data?: { alert?: ArtistAlertCriteria };
        error?: string;
      } | null;
      if (res.ok && body?.data?.alert) return { ok: true, alert: body.data.alert };
      return {
        ok: false,
        message:
          res.status === 400 && typeof body?.error === "string"
            ? body.error
            : "We couldn't save the alert. Try again in a moment.",
      };
    } catch {
      return { ok: false, message: "We couldn't save the alert. Check your connection." };
    }
  },
};
