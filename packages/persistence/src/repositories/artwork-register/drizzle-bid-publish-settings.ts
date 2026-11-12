import type { Database } from "@auction/db";
import { bidCatalogueSetting } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IBidPublishSettings } from "../../interfaces/artwork-register-integrity.js";

const BLOCK_SETTING_KEY = "block_unlinked_publish";

/** The Bid-side twin of the switch LAX Shop keeps for lax.art. Absent means off. */
export class DrizzleBidPublishSettings implements IBidPublishSettings {
  constructor(
    private readonly db: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async blockUnlinkedPublish(): Promise<boolean> {
    const [row] = await this.db
      .select({ enabled: bidCatalogueSetting.enabled })
      .from(bidCatalogueSetting)
      .where(eq(bidCatalogueSetting.key, BLOCK_SETTING_KEY))
      .limit(1);
    return row?.enabled ?? false;
  }

  async setBlockUnlinkedPublish(enabled: boolean, actorUserId: string): Promise<void> {
    const at = this.now();
    await this.db
      .insert(bidCatalogueSetting)
      .values({ key: BLOCK_SETTING_KEY, enabled, updatedAt: at, updatedBy: actorUserId })
      .onConflictDoUpdate({
        target: bidCatalogueSetting.key,
        set: { enabled, updatedAt: at, updatedBy: actorUserId },
      });
  }
}
