import type { Database } from "@auction/db";
import { mediaAsset } from "@auction/db";
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
}
