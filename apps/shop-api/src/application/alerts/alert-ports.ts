/** What an alert is about, read from the catalogue when the work is matched. */
export type AlertArtwork = {
  id: string;
  slug: string;
  title: string;
  artistId: string;
  artistName: string;
  /** An absolute image address, when the work has one. */
  imageUrl: string | null;
  /**
   * Which alert the work belongs to: an edition released in LAX Shop, or an original on lax.art.
   * Anything else never alerts.
   */
  kind: "shop_release" | "art_original";
  /** Whether the work is on sale right now. */
  published: boolean;
};

export interface AlertArtworkReader {
  /** Null when the work does not exist or is not something alerts are sent for. */
  find(artworkId: string): Promise<AlertArtwork | null>;
}

export type QueuedAnnouncement = { itemKey: string; announce: boolean };

/** Works published but not yet turned into matches. */
export interface AnnouncementQueue {
  /** Oldest first; only works that are on sale now, so a withdrawn one waits for its next publish. */
  listUnexpanded(limit: number): Promise<QueuedAnnouncement[]>;
}

export interface ArtistFollowerReader {
  /** LAX Account subjects following the artist, in id order after `after`. */
  listFollowerSubjects(artistId: string, after: string | null, limit: number): Promise<string[]>;
}

/** Written inside the publishing transaction, so a work is announced if and only if it is published. */
export interface ShopAlertAnnouncer {
  recordPublished(
    tx: unknown,
    input: { artworkId: string; kind: AlertArtwork["kind"]; announce: boolean },
  ): Promise<{ queued: number }>;
}

export type ReleaseAlertCounts = { confirmed: number; awaitingConfirmation: number };

/** What LAX Admin shows about the release list. */
export interface ReleaseAlertSummaryReader {
  counts(): Promise<ReleaseAlertCounts>;
}
