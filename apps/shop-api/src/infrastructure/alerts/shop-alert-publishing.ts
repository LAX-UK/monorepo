import type { Database } from "@auction/db";
import {
  shopAlertAnnouncement,
  shopAlertSubscriber,
  shopAlertTopic,
  shopFollowedArtist,
} from "@auction/db/schema";
import { and, asc, count, eq, gt } from "drizzle-orm";
import { artworkItemKey } from "../../application/alerts/alert-items.js";
import type {
  ArtistFollowerReader,
  ReleaseAlertCounts,
  ReleaseAlertSummaryReader,
  ShopAlertAnnouncer,
} from "../../application/alerts/alert-ports.js";

/**
 * Records a published work as announced, inside the publishing transaction, so a work is announced
 * if and only if it is published. The row is unique per work: publishing it again after an
 * unpublish queues nothing, and unticking "tell subscribers" still marks it announced.
 */
export class ShopAlertPublishRecorder implements ShopAlertAnnouncer {
  async recordPublished(
    tx: unknown,
    input: { artworkId: string; kind: "shop_release" | "art_original"; announce: boolean },
  ): Promise<{ queued: number }> {
    const db = tx as Database;
    const inserted = await db
      .insert(shopAlertAnnouncement)
      .values({ itemKey: artworkItemKey(input.artworkId), announce: input.announce })
      .onConflictDoNothing()
      .returning({ itemKey: shopAlertAnnouncement.itemKey });
    if (inserted.length === 0 || !input.announce || input.kind !== "shop_release") {
      return { queued: 0 };
    }
    const [row] = await db
      .select({ total: count() })
      .from(shopAlertTopic)
      .innerJoin(shopAlertSubscriber, eq(shopAlertSubscriber.id, shopAlertTopic.subscriberId))
      .where(
        and(
          eq(shopAlertTopic.topic, "shop.releases"),
          eq(shopAlertTopic.emailOn, true),
          eq(shopAlertSubscriber.status, "confirmed"),
        ),
      );
    return { queued: row?.total ?? 0 };
  }
}

/** Who followed an artist on lax.art. */
export class ArtistFollowerStore implements ArtistFollowerReader {
  constructor(private readonly db: Database) {}

  async listFollowerSubjects(artistId: string, after: string | null, limit: number) {
    const rows = await this.db
      .select({ subject: shopFollowedArtist.identitySubjectId })
      .from(shopFollowedArtist)
      .where(
        and(
          eq(shopFollowedArtist.artistId, artistId),
          after ? gt(shopFollowedArtist.identitySubjectId, after) : undefined,
        ),
      )
      .orderBy(asc(shopFollowedArtist.identitySubjectId))
      .limit(limit);
    return rows.map((r) => r.subject);
  }
}

/** How many people are on the release list, for LAX Admin. */
export class ReleaseAlertSummaryStore implements ReleaseAlertSummaryReader {
  constructor(private readonly db: Database) {}

  async counts(): Promise<ReleaseAlertCounts> {
    const [confirmed] = await this.db
      .select({ total: count() })
      .from(shopAlertTopic)
      .innerJoin(shopAlertSubscriber, eq(shopAlertSubscriber.id, shopAlertTopic.subscriberId))
      .where(
        and(
          eq(shopAlertTopic.topic, "shop.releases"),
          eq(shopAlertTopic.emailOn, true),
          eq(shopAlertSubscriber.status, "confirmed"),
        ),
      );
    const [pending] = await this.db
      .select({ total: count() })
      .from(shopAlertTopic)
      .innerJoin(shopAlertSubscriber, eq(shopAlertSubscriber.id, shopAlertTopic.subscriberId))
      .where(
        and(eq(shopAlertTopic.topic, "shop.releases"), eq(shopAlertSubscriber.status, "pending")),
      );
    return { confirmed: confirmed?.total ?? 0, awaitingConfirmation: pending?.total ?? 0 };
  }
}
