import type { ZohoImageSource } from "@auction/artwork-register-contracts";
import type { IArtworkImageStore, ZohoArtworkSyncMode } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { type ImageNormalizer, ImageUndecodableError } from "./image-normalizer.js";
import { planImageSync } from "./plan-image-sync.js";
import { MAX_IMAGE_BYTES, sha256Hex, sniffImageType, storedImageKey } from "./validate-image.js";
import {
  type RemoteProductImage,
  ZohoImageFetchError,
  type ZohoProductImageGateway,
} from "./zoho-product-image.js";

/** Where the stored copies go. The same bucket and key prefix Shop serves artwork images from. */
export interface ImageObjectStore {
  exists(key: string): Promise<boolean>;
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
}

/** What one picture check found, for the sync report. Counts only; no file names or content. */
export type ImageSyncReport = {
  status: "checked" | "unavailable" | "no_record";
  /** Pictures Zoho lists for the Product (after the limit). */
  remote: number;
  /** Already copied and unchanged: not fetched. */
  reused: number;
  /** Copied from Zoho this time (live), or that would be copied (dry run). */
  downloaded: number;
  /** Fetched but not a usable picture (wrong type, undecodable, too large). Skipped for good. */
  rejected: number;
  /** Could not be fetched now; the register's pictures were left as they were. */
  failed: number;
  /** Register pictures Zoho no longer lists. */
  removed: number;
  /** Pictures beyond the per-artwork limit. */
  ignored: number;
  /** True when the register's pictures changed. Always false in a dry run. */
  changed: boolean;
};

const EMPTY: Omit<ImageSyncReport, "status"> = {
  remote: 0,
  reused: 0,
  downloaded: 0,
  rejected: 0,
  failed: 0,
  removed: 0,
  ignored: 0,
  changed: false,
};

export type ZohoImageSyncDeps = {
  gateway: ZohoProductImageGateway;
  store: IArtworkImageStore;
  objects: ImageObjectStore;
  normalizer: ImageNormalizer;
  log: Logger;
  now?: () => Date;
};

type Ingested = { ok: true; source: ZohoImageSource } | { ok: false; kind: "rejected" | "failed" };

/**
 * Brings a Product's pictures from Zoho into the register: lists them, fetches only those that are
 * new or changed, checks and cleans each one, stores it under a name taken from its content, and
 * records which Zoho file each copy came from. Zoho's order is kept, so the first is the cover.
 *
 * In a dry run Zoho is listed but nothing is downloaded, stored or written. When any picture
 * cannot be fetched right now the register keeps the pictures it has, so a Zoho outage never
 * strips an artwork's cover; the next pass tries again.
 */
export class ZohoImageSyncService {
  private readonly now: () => Date;

  constructor(private readonly deps: ZohoImageSyncDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async syncProduct(productId: string, mode: ZohoArtworkSyncMode): Promise<ImageSyncReport> {
    const { gateway, store, log } = this.deps;
    const current = await store.findImageSources(productId);
    if (current === null && mode === "live") return { status: "no_record", ...EMPTY };

    let remote: RemoteProductImage[];
    try {
      remote = await gateway.listImages(productId);
    } catch (error) {
      log.warn({ err: error, productId }, "zoho pictures could not be listed");
      return { status: "unavailable", ...EMPTY };
    }

    const plan = planImageSync(remote, current ?? []);
    const base = {
      remote: plan.items.length,
      reused: plan.items.filter((item) => item.copied).length,
      removed: plan.removed,
      ignored: plan.ignored,
    };
    if (mode === "dry_run") {
      return {
        status: "checked",
        ...base,
        downloaded: plan.items.length - base.reused,
        rejected: 0,
        failed: 0,
        changed: false,
      };
    }

    const sources: ZohoImageSource[] = [];
    let downloaded = 0;
    let rejected = 0;
    let failed = 0;
    for (const item of plan.items) {
      if (item.copied) {
        sources.push(item.copied);
        continue;
      }
      const result = await this.ingest(productId, item.image);
      if (result.ok) {
        sources.push(result.source);
        downloaded += 1;
      } else if (result.kind === "rejected") {
        rejected += 1;
      } else {
        failed += 1;
      }
    }

    const counts = { ...base, downloaded, rejected, failed };
    if (failed > 0) return { status: "checked", ...counts, changed: false };

    const replaced = await store.replaceZohoImages({
      zohoProductId: productId,
      sources,
      now: this.now(),
    });
    return {
      status: replaced.status === "not_found" ? "no_record" : "checked",
      ...counts,
      changed: replaced.status === "replaced",
    };
  }

  private async ingest(productId: string, image: RemoteProductImage): Promise<Ingested> {
    const { gateway, objects, normalizer, log } = this.deps;
    let bytes: Buffer;
    try {
      bytes = await gateway.downloadImage(productId, image, MAX_IMAGE_BYTES * 2);
    } catch (error) {
      if (error instanceof ZohoImageFetchError && !error.retryable) {
        log.warn({ productId, fileId: image.fileId, reason: error.reason }, "zoho picture skipped");
        return { ok: false, kind: "rejected" };
      }
      log.warn({ err: error, productId, fileId: image.fileId }, "zoho picture not fetched");
      return { ok: false, kind: "failed" };
    }

    const type = sniffImageType(bytes);
    if (!type) {
      log.warn({ productId, fileId: image.fileId }, "zoho file is not a supported picture");
      return { ok: false, kind: "rejected" };
    }
    const sha256 = sha256Hex(bytes);
    const key = storedImageKey(sha256, type);
    try {
      if (!(await objects.exists(key))) {
        const clean = await normalizer.normalize(bytes, type, MAX_IMAGE_BYTES);
        if (clean.bytes.byteLength > MAX_IMAGE_BYTES) {
          log.warn({ productId, fileId: image.fileId }, "zoho picture is too large to store");
          return { ok: false, kind: "rejected" };
        }
        await objects.put(key, clean.bytes, type);
      }
    } catch (error) {
      if (error instanceof ImageUndecodableError) {
        log.warn({ productId, fileId: image.fileId }, "zoho picture could not be decoded");
        return { ok: false, kind: "rejected" };
      }
      log.warn({ err: error, productId, fileId: image.fileId }, "zoho picture not stored");
      return { ok: false, kind: "failed" };
    }
    return {
      ok: true,
      source: { zohoFileId: image.fileId, fingerprint: image.fingerprint, sha256, key },
    };
  }
}
