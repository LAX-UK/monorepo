import type { ObjectStoragePort } from "@auction/object-storage";
import type { ImageProbePort } from "../ports/image-probe.port.js";

/** The most bytes read back from storage to measure a picture; matches the artwork upload limit. */
const MAX_PICTURE_BYTES = 10 * 1024 * 1024;
/** Pictures registered per pass, so a first import is spread over several minutes. */
export const MEDIA_ASSET_BATCH = 25;

export type NewActiveMediaAsset = {
  key: string;
  contentType: string;
  byteSize: number;
  width: number;
  height: number;
  blurDataUrl: string;
};

/** What the registrar needs from the database; Shop owns the media table, so it is written here. */
export interface RegisterMediaAssetStore {
  /** Keys the register holds pictures for that Shop has no media record of yet. */
  findUnregisteredKeys(limit: number): Promise<string[]>;
  insertActive(asset: NewActiveMediaAsset): Promise<void>;
}

export type RegisterMediaAssetsDeps = {
  store: RegisterMediaAssetStore;
  storage: Pick<ObjectStoragePort, "headObject" | "getObjectBytes">;
  probe: ImageProbePort;
  onSkipped: (key: string, reason: string) => void;
};

/**
 * Gives every picture the Zoho sync stored a media record (size and a blurred placeholder), the
 * way an uploaded artwork image has, so lax.art shows it the same way. A picture whose file is not
 * in storage yet, or cannot be read, is skipped and tried again on the next pass.
 */
export async function registerMissingMediaAssets(deps: RegisterMediaAssetsDeps): Promise<number> {
  const keys = await deps.store.findUnregisteredKeys(MEDIA_ASSET_BATCH);
  let registered = 0;
  for (const key of keys) {
    try {
      const head = await deps.storage.headObject(key);
      if (!head) {
        deps.onSkipped(key, "not_in_storage");
        continue;
      }
      const bytes = await deps.storage.getObjectBytes(key, MAX_PICTURE_BYTES);
      if (!bytes || bytes.byteLength === 0) {
        deps.onSkipped(key, "unreadable");
        continue;
      }
      const { width, height } = await deps.probe.analyze(bytes);
      const blurDataUrl = await deps.probe.makeLqip(bytes);
      await deps.store.insertActive({
        key,
        contentType: head.contentType,
        byteSize: head.byteSize,
        width,
        height,
        blurDataUrl,
      });
      registered += 1;
    } catch {
      deps.onSkipped(key, "failed");
    }
  }
  return registered;
}
