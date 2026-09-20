import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const homeAssets = resolve(import.meta.dirname, "../../apps/shop/public/shop/home");
const MAX_ASSET_BYTES = 550_000;
const MAX_HERO_BYTES = 900_000;
const MAX_HOME_RASTER_BYTES = 1_600_000;

const files = await readdir(homeAssets);
const rasterFiles = files.filter((file) => /\.(?:avif|png|webp)$/i.test(file));
const sizes = await Promise.all(
  rasterFiles.map(async (file) => ({ file, bytes: (await stat(resolve(homeAssets, file))).size })),
);

const oversized = sizes.filter(({ bytes }) => bytes > MAX_ASSET_BYTES);
const legacyPng = sizes.filter(({ file }) => file.endsWith(".png"));
const heroBytes = sizes
  .filter(({ file }) => file.startsWith("hero-"))
  .reduce((total, { bytes }) => total + bytes, 0);
const totalBytes = sizes.reduce((total, { bytes }) => total + bytes, 0);

const failures = [
  ...oversized.map(({ file, bytes }) => `${file} is ${bytes} bytes (max ${MAX_ASSET_BYTES})`),
  ...legacyPng.map(({ file }) => `${file} must be optimized to WebP or AVIF`),
  ...(heroBytes > MAX_HERO_BYTES
    ? [`Hero imagery is ${heroBytes} bytes (max ${MAX_HERO_BYTES})`]
    : []),
  ...(totalBytes > MAX_HOME_RASTER_BYTES
    ? [`Home raster imagery is ${totalBytes} bytes (max ${MAX_HOME_RASTER_BYTES})`]
    : []),
];

if (failures.length > 0) {
  throw new Error(`Shop asset budget failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Shop asset budget passed (${sizes.length} images, ${totalBytes} bytes; hero ${heroBytes} bytes).`,
);
