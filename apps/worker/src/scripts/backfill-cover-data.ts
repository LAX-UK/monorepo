import { createDb, sale } from "@auction/db";
/**
 * Fills in the picture data the home cover needs for pictures already in LAX storage:
 *   1. width, height and blur preview for lot photographs, sale covers and cover slot pictures
 *      that have no `media_asset` row yet;
 *   2. optionally, named cover slots for sales that still hold their covers in the old array;
 *   3. the measured colours and text scrim for every cover slot that has none;
 *   4. width, height and blur preview for lot photographs and sale covers held as full https
 *      addresses (seeded or imported, never uploaded), stored under the address itself.
 *
 * Every picture is held to the floors: a lot photograph needs a long side of 800 px to hang on
 * the plate, and a cover slot needs its slot floor (default 2400 px wide, wide 2880 × 1080,
 * phone 1200 × 1200). A picture below its floor is never stretched or written as a slot; it is
 * listed in the report instead. A slot staff have already set is never changed, and a second
 * run finds nothing left to do.
 *
 * The dry run reads the pictures (a read-only fetch and measure) and writes nothing.
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
import { and, eq, isNull, sql } from "drizzle-orm";
import pino from "pino";
import { loadWorkerEnv } from "../env.js";
import { analyseSaleCoversJob } from "../jobs/analyse-sale-covers.js";
import { processImageJob } from "../jobs/process-image.js";
import { listCatalogueImageKeys, normalizeCatalogueKey } from "../lib/catalogue-image-keys.js";
import { type PictureReport, summarisePictures } from "../lib/cover-backfill-report.js";
import { coverSlotVerdict, lotPlateVerdict } from "../lib/cover-picture-verdict.js";
import { fetchExternalPicture, meanLuminance } from "../lib/external-picture.js";
import { loadMediaAssetSizes } from "../lib/media-asset-sizes.js";
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

/** Full https addresses the lots lead with, and the ones the sales use as covers, with no stored size. */
async function externalPictures(db: Db, limit: number | undefined) {
  const cap = limit ?? 100_000;
  const lots = await db.execute<{ url: string }>(sql`
    select distinct refs.url as url
    from (select l.images[1] as url from lot l where cardinality(l.images) > 0) refs
    where refs.url like 'https://%'
      and not exists (select 1 from media_asset ma where ma.key = refs.url)
    order by refs.url limit ${cap}`);
  const covers = await db.execute<{ url: string }>(sql`
    select distinct refs.url as url
    from (select unnest(s.cover_images) as url from sale s where s.deleted_at is null) refs
    where refs.url like 'https://%'
      and not exists (select 1 from media_asset ma where ma.key = refs.url)
    order by refs.url limit ${cap}`);
  return {
    lots: lots.rows.map((row) => row.url),
    covers: covers.rows.map((row) => row.url),
  };
}

type Measured = { url: string; report: PictureReport; bytes?: Buffer; blurDataURL?: string };

async function measureExternal(
  role: PictureReport["role"],
  url: string,
  processor: SharpImageProcessor,
): Promise<Measured> {
  try {
    const bytes = await fetchExternalPicture(url);
    const { width, height } = await processor.analyze(bytes);
    const luminance = await meanLuminance(bytes);
    const verdict =
      role === "lot-primary"
        ? lotPlateVerdict({ width, height })
        : coverSlotVerdict("default", { width, height });
    return {
      url,
      bytes,
      blurDataURL: await processor.makeLqip(bytes),
      report: { role, source: url, width, height, luminance, verdict },
    };
  } catch (error) {
    return {
      url,
      report: {
        role,
        source: url,
        verdict: {
          ok: false,
          reason: "unreadable",
          error: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
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

  const legacySizes = await loadMediaAssetSizes(
    db,
    legacy.map((item) => item.key),
  );
  const legacyPlan = legacy.map((item) => {
    const size = legacySizes.get(item.key);
    return {
      sale: item.saleId,
      slot: item.name,
      key: item.key,
      outcome: !size
        ? "waits for size"
        : coverSlotVerdict(item.name, size).ok
          ? "would become a slot"
          : "below floor, skipped",
    };
  });

  // 0. Pictures held as full https addresses: read and measured now, stored only on --apply.
  const processor = new SharpImageProcessor();
  const external = await externalPictures(db, limit);
  const measured: Measured[] = [];
  for (const url of external.lots)
    measured.push(await measureExternal("lot-primary", url, processor));
  for (const url of external.covers) {
    measured.push(await measureExternal("sale-cover", url, processor));
  }
  const externalSummary = summarisePictures(measured.map((entry) => entry.report));

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        externalPictures: { ...externalSummary, pictures: measured.map((entry) => entry.report) },
        picturesWithoutSize: keys.length,
        legacyCoversToMaterialise: legacy.length,
        legacyPlan,
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
  let externalStored = 0;
  for (const entry of measured) {
    const { report, blurDataURL } = entry;
    if (!blurDataURL || report.width == null || report.height == null) continue;
    await mediaAssetProcessorRepo.upsertProcessed({
      key: entry.url,
      width: report.width,
      height: report.height,
      blurDataURL,
    });
    externalStored += 1;
  }
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
  const belowFloor: PictureReport[] = [];
  if (materialise && legacy.length > 0) {
    const writer = createDb(env.DATABASE_URL);
    for (const item of legacy) {
      const size = await writer.execute<{ width: number; height: number }>(
        sql`select width, height from media_asset where key = ${item.key}`,
      );
      const row = size.rows[0];
      if (!row) continue;
      const verdict = coverSlotVerdict(item.name, { width: row.width, height: row.height });
      if (!verdict.ok) {
        belowFloor.push({
          role: "sale-cover",
          source: `${item.saleId} ${item.name}: ${item.key}`,
          width: row.width,
          height: row.height,
          verdict,
        });
        continue;
      }
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
        .where(
          and(eq(sale.id, item.saleId), sql`not jsonb_exists(${sale.coverSlots}, ${item.name})`),
        );
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
    JSON.stringify(
      {
        sized,
        sizeFailed,
        externalStored,
        materialised,
        slotsBelowFloor: summarisePictures(belowFloor).skipped,
        analysed: ready,
        failed,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
