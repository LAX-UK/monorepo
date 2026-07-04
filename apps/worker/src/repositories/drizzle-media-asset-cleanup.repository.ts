import type { Database } from "@auction/db";
import { itemSubmission, lot, mediaAsset, sale, user } from "@auction/db";
import { eq, sql } from "drizzle-orm";
import type { IMediaAssetCleanupRepository } from "../interfaces/media-asset-cleanup.repository.js";

export class DrizzleMediaAssetCleanupRepository implements IMediaAssetCleanupRepository {
  constructor(private readonly db: Database) {}

  async isKeyReferenced(values: readonly string[]): Promise<boolean> {
    const refs = sql`array[${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )}]::text[]`;
    const result = await this.db.execute<{ referenced: boolean }>(sql`
      select exists (
          select 1 from ${user} where ${user.image} = any(${values})
          union all
          select 1 from ${lot} where ${lot.images} && ${refs}
          union all
          select 1 from ${sale} where ${sale.coverImages} && ${refs}
          union all
          select 1 from ${itemSubmission} where ${itemSubmission.images} && ${refs}
        ) as "referenced"
    `);
    const row = result.rows[0];
    return Boolean(row?.referenced);
  }

  async getVariants(key: string): Promise<Record<string, string> | null> {
    const [asset] = await this.db
      .select({ variants: mediaAsset.variants })
      .from(mediaAsset)
      .where(eq(mediaAsset.key, key))
      .limit(1);
    if (!asset?.variants) return null;
    return asset.variants as Record<string, string>;
  }

  async deleteByKey(key: string): Promise<void> {
    await this.db.delete(mediaAsset).where(eq(mediaAsset.key, key));
  }
}
