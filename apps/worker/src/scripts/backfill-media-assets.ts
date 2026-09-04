/**
 * Backfill `media_asset` rows (width, height, LQIP) for catalogue images uploaded
 * before the process-image worker job existed.
 *
 * Dry-run (default):
 *   pnpm --filter @auction/worker backfill:media-assets
 *
 * Apply:
 *   pnpm --filter @auction/worker backfill:media-assets -- --apply
 *
 * Optional:
 *   --limit=100
 *   --force   Re-process keys that already have a media_asset row
 */
import {
  artistProfile,
  bidIdentityDirectory,
  category,
  createDb,
  itemSubmission,
  lot,
  mediaAsset,
  sale,
} from "@auction/db";
import { sql } from "drizzle-orm";
import pino from "pino";
import { loadWorkerEnv } from "../env.js";
import { processImageJob } from "../jobs/process-image.js";
import { SharpImageProcessor } from "../lib/sharp-image-processor.js";
import { createUploadStorage } from "../lib/upload-storage.js";
import { DrizzleMediaAssetProcessorRepository } from "../repositories/drizzle-media-asset-processor.repository.js";

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const force = argv.includes("--force");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;
  if (limitArg && (!limit || Number.isNaN(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }
  return { apply, force, limit };
}

function normalizeCatalogueKey(value: string, publicBaseUrl?: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;

  if (publicBaseUrl) {
    const prefix = `${publicBaseUrl.replace(/\/$/, "")}/`;
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length)).replace(/^\/+/, "");
    }
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return null;
  }

  return trimmed.replace(/^\/+/, "");
}

async function listCatalogueImageKeys(
  db: ReturnType<typeof createDb>,
  opts: { force: boolean; limit?: number },
): Promise<string[]> {
  const limitSql = opts.limit ? sql`limit ${opts.limit}` : sql``;
  const missingOnlySql = opts.force
    ? sql``
    : sql`and not exists (select 1 from ${mediaAsset} ma where ma.key = refs.key)`;

  const result = await db.execute<{ key: string }>(sql`
    select distinct refs.key as key
    from (
      select unnest(${lot.images}) as key from ${lot} where cardinality(${lot.images}) > 0
      union
      select unnest(${sale.coverImages}) as key from ${sale} where cardinality(${sale.coverImages}) > 0
      union
      select unnest(${itemSubmission.images}) as key from ${itemSubmission} where cardinality(${itemSubmission.images}) > 0
      union
      select ${category.heroImageKey} as key from ${category} where ${category.heroImageKey} is not null
      union
      select ${artistProfile.portraitUrl} as key from ${artistProfile} where ${artistProfile.portraitUrl} is not null
      union
      select ${artistProfile.heroImageUrl} as key from ${artistProfile} where ${artistProfile.heroImageUrl} is not null
      union
      select ${bidIdentityDirectory.image} as key
      from ${bidIdentityDirectory}
      where ${bidIdentityDirectory.image} is not null
    ) refs
    where refs.key is not null and trim(refs.key) <> ''
    ${missingOnlySql}
    order by refs.key
    ${limitSql}
  `);

  return result.rows.map((row) => row.key);
}

async function main() {
  const { apply, force, limit } = parseArgs(process.argv.slice(2));
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const storage = createUploadStorage(env);
  const mediaAssetProcessorRepo = new DrizzleMediaAssetProcessorRepository(db);
  const processor = new SharpImageProcessor();
  const log = pino({ level: "info" });

  const publicBaseUrl =
    env.STORAGE_DRIVER === "s3" && env.S3_BUCKET && env.S3_REGION
      ? (env.S3_PUBLIC_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`)
      : undefined;

  const rawKeys = await listCatalogueImageKeys(db, { force, ...(limit != null ? { limit } : {}) });
  const keys = [
    ...new Set(
      rawKeys
        .map((key) => normalizeCatalogueKey(key, publicBaseUrl))
        .filter((key): key is string => Boolean(key)),
    ),
  ];

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        force,
        candidateCount: keys.length,
        sample: keys.slice(0, 5),
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry-run complete. Re-run with --apply to process images.");
    return;
  }

  let processed = 0;
  let failed = 0;
  for (const key of keys) {
    try {
      await processImageJob({ mediaAssetProcessorRepo, storage, processor, key, log });
      processed += 1;
      if (processed % 25 === 0) {
        console.log(`processed ${processed}/${keys.length}...`);
      }
    } catch (err) {
      failed += 1;
      console.error({ key, err }, "backfill failed for key");
    }
  }

  console.log(JSON.stringify({ processed, failed, total: keys.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
