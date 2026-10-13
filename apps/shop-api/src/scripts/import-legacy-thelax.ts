/**
 * Imports www.thelax.art content into the Art catalogue/editorial tables and writes the
 * legacy redirect map Art's middleware serves. See docs/runbooks/thelax-seo-migration.md.
 *
 *   pnpm --filter @auction/shop-api import:legacy-thelax -- --plan-only
 *   pnpm --filter @auction/shop-api import:legacy-thelax -- --export <file> [--report-out <file>]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  LEGACY_THELAX_IMPORT_ACTOR,
  importLegacyThelax,
} from "../application/legacy-thelax/import-legacy-thelax.service.js";
import { createLegacyMediaImporter } from "../application/legacy-thelax/legacy-media-importer.js";
import { parseLegacyThelaxExport } from "../application/legacy-thelax/legacy-thelax-export.js";
import {
  buildLegacyRedirects,
  legacyRedirectsFile,
  plannedArtworkSlugs,
} from "../application/legacy-thelax/legacy-thelax-redirects.js";
import { createShopApiContainer } from "../container.js";
import { loadShopApiEnv } from "../env.js";
import { createDrizzleShopMediaAssetRepository } from "../infrastructure/drizzle-shop-media-asset.repository.js";
import { createDrizzleLegacyThelaxContentStore } from "../infrastructure/legacy-thelax/drizzle-legacy-thelax-content.store.js";
import { createHttpLegacyMediaFetcher } from "../infrastructure/legacy-thelax/http-legacy-media.fetcher.js";
import { createJsonFileLegacyExportSource } from "../infrastructure/legacy-thelax/json-file-legacy-export.source.js";
import { createSharpImageProbe } from "../infrastructure/sharp-image-probe.js";
import { resolveShopMediaStorage } from "../infrastructure/shop-media-storage.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    export: { type: "string", default: ".tmp/seo/legacy-thelax-export.json" },
    "redirects-out": { type: "string", default: "apps/art/src/lib/seo/legacy-redirects.json" },
    "report-out": { type: "string" },
    "plan-only": { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
  },
});

const fromRoot = (path: string) => resolve(repoRoot, path);

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

const data = parseLegacyThelaxExport(
  await createJsonFileLegacyExportSource(fromRoot(values.export)).read(),
);
const redirectsOut = fromRoot(values["redirects-out"]);

if (values["plan-only"]) {
  const redirects = buildLegacyRedirects(data, {
    artworkSlugs: plannedArtworkSlugs(data.artworks),
  });
  await writeJson(redirectsOut, legacyRedirectsFile(data, redirects, new Date()));
  console.log(
    `import-legacy-thelax: planned ${Object.keys(redirects).length} redirects -> ${redirectsOut}`,
  );
  process.exit(0);
}

const env = loadShopApiEnv();
const mediaStorage = resolveShopMediaStorage(env);
if (!mediaStorage) {
  console.error("import-legacy-thelax: S3 media storage must be configured to import images");
  process.exit(1);
}
const container = createShopApiContainer(env);

try {
  const media = createLegacyMediaImporter({
    fetcher: createHttpLegacyMediaFetcher(),
    storage: mediaStorage.storage,
    assets: createDrizzleShopMediaAssetRepository(container.db),
    imageProbe: createSharpImageProbe(),
    actor: LEGACY_THELAX_IMPORT_ACTOR,
  });
  const { redirects, report } = await importLegacyThelax(
    {
      importArtwork: container.importArtwork,
      store: createDrizzleLegacyThelaxContentStore(container.db),
      media,
    },
    data,
    {
      concurrency: Math.max(1, Number.parseInt(values.concurrency, 10) || 1),
      log: (message) => console.log(`import-legacy-thelax: ${message}`),
    },
  );
  await writeJson(redirectsOut, legacyRedirectsFile(data, redirects, new Date()));
  if (values["report-out"]) await writeJson(fromRoot(values["report-out"]), report);
  console.log(
    JSON.stringify(
      { ...report, media: { ...report.media, failed: report.media.failed.length } },
      null,
      2,
    ),
  );
  console.log(
    `import-legacy-thelax: ${Object.keys(redirects).length} redirects -> ${redirectsOut}`,
  );
  if (report.errors.length > 0) process.exitCode = 1;
} finally {
  await container.close();
}
