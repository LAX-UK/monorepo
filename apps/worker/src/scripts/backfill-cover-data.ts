import { createDb, sale } from "@auction/db";
/**
 * Fills in the picture data the home cover needs for pictures already in LAX storage:
 *   1. width, height and blur preview for lot photographs, sale covers and cover slot pictures
 *      that have no `media_asset` row yet;
 *   2. optionally, named cover slots for sales that still hold their covers in the old array;
 *   3. the measured colours and text scrim for every cover slot that has none.
 *
 * Dry-run (default):
 *   pnpm --filter @auction/worker backfill:cover-data
 *
 * Apply:
 *   pnpm --filter @auction/worker backfill:cover-data -- --apply
 *
 * Optional:
 *   --limit=100            Visit at most this many pictures or slots per step
 *   --materialise-covers   Turn the old cover array into named slots (default, phone, wide) with
 *                          a centred focal point, writing with DATABASE_URL (the worker role
 *                          cannot write sales). Run it once the admin sets slots, so the old
 *                          array and the slots do not drift apart.
 */
import { coverAnalysisHash } from "@auction/domain";
import { resolveCoverSlotSources } from "@auction/domain";
import { SALE_COVER_SLOT_NAMES, type SaleCoverSlot, type SaleCoverSlotName } from "@auction/types";
import { eq, isNull, sql } from "drizzle-orm";
import pino from "pino";
import { loadWorkerEnv } from "../env.js";
import { analyseSaleCoversJob } from "../jobs/analyse-sale-covers.js";
import { processImageJob } from "../jobs/process-image.js";
import { listCatalogueImageKeys, normalizeCatalogueKey } from "../lib/catalogue-image-keys.js";
import { SharpCoverImageAnalyser } from "../lib/sharp-cover-image-analyser.js";
import { SharpImageProcessor } from "../lib/sharp-image-processor.js";
import { createUploadStorage } from "../lib/upload-storage.js";
import { DrizzleCoverAnalysisJobRepository } from "../repositories/drizzle-cover-analysis-job.repository.js";
import { DrizzleMediaAssetProcessorRepository } from "../repositories/drizzle-media-asset-processor.repository.js";

function parseArgs(argv: string[]) {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;
  if (limitArg && (!limit || Number.isNaN(limit) || limit <= 0)) {
    throw new Error("--limit must be a positive integer");
  }
  return {
    apply: argv.includes("--apply"),
    materialise: argv.includes("--materialise-covers"),
    limit,
  };
}

type Db = ReturnType<typeof createDb>;

async function legacyCoverSlots(db: Db, limit: number | undefined) {
  const rows = await db
    .select({
      id: sale.id,
      title: sale.title,
      coverImages: sale.coverImages,
      coverSlots: sale.coverSlots,
    })
    .from(sale)
    .where(isNull(sale.deletedAt))
    .limit(limit ?? 100_000);
  const out: { saleId: string; name: SaleCoverSlotName; key: string; title: string }[] = [];
  for (const row of rows) {
    const sources = resolveCoverSlotSources(row.coverSlots, row.coverImages ?? []);
    for (const name of SALE_COVER_SLOT_NAMES) {
      const source = sources[name];
      if (source?.kind === "legacy") {
        out.push({ saleId: row.id, name, key: source.key, title: row.title });
      }
    }
  }
  return out;
}

async function main() {
  const { apply, materialise, limit } = parseArgs(process.argv.slice(2));
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const storage = createUploadStorage(env);
  const log = pino({ level: "info" });
  const publicBaseUrl =
    env.STORAGE_DRIVER === "s3" && env.S3_BUCKET && env.S3_REGION
      ? (env.S3_PUBLIC_BASE_URL ?? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`)
      : undefined;

  // 1. Sizes and previews.
  const keys = [
    ...new Set(
      (await listCatalogueImageKeys(db, { force: false, ...(limit != null ? { limit } : {}) }))
        .map((key) => normalizeCatalogueKey(key, publicBaseUrl))
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  const legacy = materialise ? await legacyCoverSlots(db, limit) : [];
  const jobRepo = new DrizzleCoverAnalysisJobRepository(db);
  const pending = await jobRepo.listPending(limit ?? 1000);

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        picturesWithoutSize: keys.length,
        legacyCoversToMaterialise: legacy.length,
        coverSlotsToAnalyse: pending.length,
        sample: keys.slice(0, 5),
      },
      null,
      2,
    ),
  );
  if (!apply) {
    console.log("Dry-run complete. Re-run with --apply to change anything.");
    return;
  }

  const mediaAssetProcessorRepo = new DrizzleMediaAssetProcessorRepository(db);
  const processor = new SharpImageProcessor();
  let sized = 0;
  let sizeFailed = 0;
  for (const key of keys) {
    try {
      await processImageJob({ mediaAssetProcessorRepo, storage, processor, key, log });
      sized += 1;
    } catch (err) {
      sizeFailed += 1;
      console.error({ key, err }, "size backfill failed for key");
    }
  }

  // 2. Named slots from the old array. Needs a connection that may write sales.
  let materialised = 0;
  if (materialise && legacy.length > 0) {
    const writer = createDb(env.DATABASE_URL);
    for (const item of legacy) {
      const size = await writer.execute<{ width: number; height: number }>(
        sql`select width, height from media_asset where key = ${item.key}`,
      );
      const row = size.rows[0];
      if (!row) continue;
      const draft = {
        key: item.key,
        width: row.width,
        height: row.height,
        focal: { x: 0.5, y: 0.5 },
        zoom: 1,
        alt: `${item.title} — auction cover`,
      };
      const slot: SaleCoverSlot = { ...draft, analysisHash: coverAnalysisHash(item.name, draft) };
      await writer
        .update(sale)
        .set({
          coverSlots: sql`${sale.coverSlots} || ${JSON.stringify({ [item.name]: slot })}::jsonb`,
        })
        .where(eq(sale.id, item.saleId));
      materialised += 1;
    }
  }

  // 3. Colours and scrim for every slot without them, a batch at a time.
  const analyser = new SharpCoverImageAnalyser();
  let ready = 0;
  let failed = 0;
  for (let round = 0; round < 1000; round++) {
    const result = await analyseSaleCoversJob({ repo: jobRepo, storage, analyser, log }, 25);
    ready += result.ready;
    failed += result.failed;
    if (result.ready + result.failed === 0) break;
  }

  console.log(
    JSON.stringify({ sized, sizeFailed, materialised, analysed: ready, failed }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
