import type { Database } from "@auction/db";
import { lot, mediaAsset } from "@auction/db";
import { sql } from "drizzle-orm";
import type { IMediaAssetProcessorRepository } from "../interfaces/media-asset-processor.repository.js";

export class DrizzleMediaAssetProcessorRepository implements IMediaAssetProcessorRepository {
  constructor(private readonly db: Database) {}

  async upsertProcessed(input: {
    key: string;
    width: number;
    height: number;
    blurDataURL: string;
  }): Promise<void> {
    const { key, width, height, blurDataURL } = input;
    await this.db
      .insert(mediaAsset)
      .values({ key, width, height, blurDataURL })
      .onConflictDoUpdate({
        target: mediaAsset.key,
        set: {
          width,
          height,
          blurDataURL,
          processedAt: new Date(),
        },
      });
  }

  async listUnmeasuredExternalLotPictures(
    limit: number,
    exclude: readonly string[],
  ): Promise<string[]> {
    const skip = exclude.length > 0 ? sql`and refs.url <> all(${exclude}::text[])` : sql``;
    const result = await this.db.execute<{ url: string }>(sql`
      select distinct refs.url as url
      from (select ${lot.images}[1] as url from ${lot} where cardinality(${lot.images}) > 0) refs
      where refs.url like 'https://%'
        and not exists (select 1 from ${mediaAsset} ma where ma.key = refs.url)
        ${skip}
      order by refs.url
      limit ${limit}
    `);
    return result.rows.map((row) => row.url);
  }
}
