import type { Database } from "@auction/db";
import { ARTIST_APPLICATION_REVIEW_WEEKS } from "@auction/shop-domain";
import type { ArtistApplicationNotifier } from "../../application/artist-applications/artist-application.ports.js";
import { insertShopEmailOutbox } from "../drizzle-shop-notification.publisher.js";

/** Where the emails send the artist, on lax.art: the application, and the portal hand-off. */
export type ArtistApplicationLinks = { applicationUrl: string; portalUrl: string };

export function artistApplicationLinks(artPublicUrl: string): ArtistApplicationLinks {
  const base = artPublicUrl.replace(/\/+$/, "");
  return {
    applicationUrl: `${base}/for-artists/apply`,
    portalUrl: `${base}/for-artists/portal`,
  };
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

/**
 * The applicant's emails, queued in the email outbox inside the transaction that made the
 * change. Each key names the application and the moment, so a retried transaction never sends
 * twice and a second question on the same application still does.
 */
export function createOutboxArtistApplicationNotifier(
  db: Database,
  links: ArtistApplicationLinks,
  now: () => Date,
): ArtistApplicationNotifier {
  const key = (kind: string, reference: string) =>
    `artist-application:${reference}:${kind}:${now().toISOString()}`;
  return {
    async received({ to, reference, artistName }) {
      await insertShopEmailOutbox(db, {
        idempotencyKey: key("received", reference),
        to,
        template: "art-artist-application-received",
        vars: {
          artistName,
          reference,
          replyWeeks: ARTIST_APPLICATION_REVIEW_WEEKS,
          applicationUrl: links.applicationUrl,
        },
      });
    },
    async moreInformationNeeded({ to, reference, artistName, message }) {
      await insertShopEmailOutbox(db, {
        idempotencyKey: key("more-info", reference),
        to,
        template: "art-artist-application-more-info",
        vars: { artistName, reference, message, applicationUrl: links.applicationUrl },
      });
    },
    async declined({ to, reference, artistName, reason, reapplyFrom }) {
      await insertShopEmailOutbox(db, {
        idempotencyKey: key("declined", reference),
        to,
        template: "art-artist-application-declined",
        vars: {
          artistName,
          reference,
          reason,
          reapplyFrom: LONG_DATE.format(reapplyFrom),
          applicationUrl: links.applicationUrl,
        },
      });
    },
    async welcome({ to, reference, artistName }) {
      await insertShopEmailOutbox(db, {
        idempotencyKey: key("welcome", reference),
        to,
        template: "art-artist-application-welcome",
        vars: { artistName, reference, portalUrl: links.portalUrl },
      });
    },
  };
}
