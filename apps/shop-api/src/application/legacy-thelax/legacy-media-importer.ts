import { createHash } from "node:crypto";
import type { ObjectStoragePort } from "@auction/object-storage";
import {
  type ShopMediaKind,
  extensionForContentType,
  matchesDeclaredImageType,
  shopMediaPolicy,
} from "../../domain/shop-media-upload-policy.js";
import type {
  ImageFormat,
  ImageNormalizerPort,
  NormalizedImage,
} from "../ports/image-normalizer.port.js";
import type { ImageProbePort } from "../ports/image-probe.port.js";
import type { LegacyMediaFetcher } from "../ports/legacy-thelax-import.ports.js";
import type { ShopMediaAssetRepository } from "../ports/shop-media-asset.repository.js";

export type LegacyMediaImporterDeps = {
  fetcher: LegacyMediaFetcher;
  storage: ObjectStoragePort;
  assets: ShopMediaAssetRepository;
  imageProbe: ImageProbePort;
  imageNormalizer: ImageNormalizerPort;
  actor: string;
};

/** Per-image result: what the source file was and what was stored. */
export type LegacyMediaImageResult = {
  url: string;
  key: string;
  original: { width: number; height: number; bytes: number };
  stored: { width: number; height: number; bytes: number };
  resized: boolean;
};

export type LegacyMediaStats = {
  imported: number;
  reused: number;
  failed: string[];
  images: LegacyMediaImageResult[];
};

export type LegacyMediaImporter = {
  importImage(url: string, kind: ShopMediaKind, alt: string | null): Promise<string | null>;
  /** Legacy image path → public URL of every image imported or reused this run. */
  publicUrls(): ReadonlyMap<string, string>;
  stats(): LegacyMediaStats;
};

const SNIFFED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALT_MAX_LENGTH = 500;

function sniffContentType(bytes: Buffer): string | null {
  return SNIFFED_TYPES.find((type) => matchesDeclaredImageType(type, bytes)) ?? null;
}

/** Same legacy image and kind always map to the same key, so re-runs reuse uploads. */
export function legacyMediaKey(kind: ShopMediaKind, url: string, contentType: string): string {
  const digest = createHash("sha256").update(url).digest("hex").slice(0, 32);
  return `${shopMediaPolicy(kind).keyPrefix}/thelax-${digest}.${extensionForContentType(contentType)}`;
}

function contentTypeFromUrl(url: URL): string | null {
  const ext = url.pathname.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export function createLegacyMediaImporter(deps: LegacyMediaImporterDeps): LegacyMediaImporter {
  const inFlight = new Map<string, Promise<string | null>>();
  const publicUrls = new Map<string, string>();
  const stats: LegacyMediaStats = { imported: 0, reused: 0, failed: [], images: [] };

  async function importOnce(
    url: URL,
    kind: ShopMediaKind,
    key: string,
    alt: string | null,
  ): Promise<string | null> {
    const existing = await deps.assets.findByKey(key);
    if (existing?.status === "active") {
      stats.reused += 1;
      return key;
    }
    const fetched = await deps.fetcher.fetch(url.href).catch(() => null);
    const sniffed = fetched ? sniffContentType(fetched) : null;
    const policy = shopMediaPolicy(kind);
    if (!fetched || !sniffed || !policy.allowedContentTypes.includes(sniffed)) {
      stats.failed.push(url.href);
      return null;
    }
    // Oversized files are scaled down rather than rejected; only undecodable bytes fail.
    let image: NormalizedImage;
    let probed: { width: number; height: number; blurDataUrl: string };
    try {
      image = await deps.imageNormalizer.normalize(fetched, sniffed as ImageFormat);
      const dimensions = await deps.imageProbe.analyze(image.bytes);
      probed = { ...dimensions, blurDataUrl: await deps.imageProbe.makeLqip(image.bytes) };
    } catch {
      stats.failed.push(url.href);
      return null;
    }
    await deps.storage.putObject(key, image.bytes, image.contentType);
    if (!existing) {
      await deps.assets.insertPending({
        key,
        kind,
        contentType: image.contentType,
        byteSize: image.bytes.byteLength,
        createdBySubjectId: deps.actor,
      });
    }
    await deps.assets.markActive({
      key,
      ...probed,
      alt: alt?.trim() ? alt.trim().slice(0, ALT_MAX_LENGTH) : null,
    });
    stats.imported += 1;
    stats.images.push({
      url: url.href,
      key,
      original: image.original,
      stored: image.stored,
      resized: image.stored.bytes !== image.original.bytes,
    });
    return key;
  }

  return {
    importImage(rawUrl, kind, alt) {
      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        stats.failed.push(rawUrl);
        return Promise.resolve(null);
      }
      const declared = contentTypeFromUrl(url);
      if (!declared) {
        stats.failed.push(url.href);
        return Promise.resolve(null);
      }
      const key = legacyMediaKey(kind, url.href, declared);
      let pending = inFlight.get(key);
      if (!pending) {
        pending = importOnce(url, kind, key, alt).then((imported) => {
          if (imported) publicUrls.set(url.pathname, deps.storage.getPublicUrl(imported));
          return imported;
        });
        inFlight.set(key, pending);
      }
      return pending;
    },
    publicUrls: () => publicUrls,
    stats: () => stats,
  };
}
