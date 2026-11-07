/**
 * Mirrors the demo pictures to the media bucket so the test apps serve small copies from the CDN.
 * Reads the shared catalogue (`demoImageCatalogue`), downloads each museum original once, resizes
 * it for how the demo uses it and uploads it under `demo/`. A copy already stored at the same size
 * is left alone, so a second run uploads nothing. Run it before the demo seeds.
 *
 *   pnpm --filter @auction/worker exec tsx src/scripts/mirror-demo-images.ts
 */
import { demoImageCatalogue } from "@auction/db";
import { loadWorkerEnv } from "../env.js";
import { mirrorDemoPictures } from "../lib/demo-image-mirror.js";
import { fetchExternalPicture } from "../lib/external-picture.js";
import { createUploadStorage } from "../lib/upload-storage.js";

const env = loadWorkerEnv();
if (env.STORAGE_DRIVER !== "s3") {
  throw new Error(
    "mirror-demo-images needs STORAGE_DRIVER=s3: the copies belong in the media bucket",
  );
}
const storage = createUploadStorage(env);
const entries = demoImageCatalogue();
console.log(`mirror-demo-images: ${entries.length} pictures`);

const outcomes = await mirrorDemoPictures(entries, {
  storage,
  fetchPicture: (url) => fetchExternalPicture(url),
});

let total = 0;
for (const outcome of outcomes) {
  if (outcome.status === "failed") {
    console.error(`  failed ${outcome.key}: ${outcome.reason}`);
    continue;
  }
  total += outcome.bytes;
  console.log(`  ${outcome.status} ${outcome.key} ${outcome.bytes} bytes`);
}
const failed = outcomes.filter((o) => o.status === "failed").length;
const uploaded = outcomes.filter((o) => o.status === "uploaded").length;
console.log(
  `mirror-demo-images: ${uploaded} uploaded, ${outcomes.length - uploaded - failed} unchanged, ${failed} failed, ${total} bytes stored`,
);
if (failed > 0) process.exit(1);
