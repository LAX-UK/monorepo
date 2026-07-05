import type { IObjectStorage } from "./interfaces/object-storage.js";
import type { ISignedUrlPolicy } from "./signed-url-policy.js";
import { PerRequestSigningPolicy } from "./signed-url-policy.js";

import type { IMediaUrlResolver } from "./interfaces/media-url-resolver.js";

export type StorageReadMode = "public" | "signed";

export class MediaUrlResolver implements IMediaUrlResolver {
  constructor(
    private readonly storage: IObjectStorage,
    private readonly readMode: StorageReadMode,
    private readonly signedUrlPolicy: ISignedUrlPolicy = new PerRequestSigningPolicy(3600),
  ) {}

  async resolve(value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    const key = this.storage.extractKey(value);
    if (!key) return value;
    if (this.readMode === "signed") {
      const now = new Date();
      return (
        await this.storage.createPresignedGet({
          key,
          expiresInSec: this.signedUrlPolicy.expiresInSec,
          signingDate: this.signedUrlPolicy.signingDate(now),
        })
      ).url;
    }
    return this.storage.getPublicUrl(key);
  }

  async resolveMany(values: readonly string[]): Promise<string[]> {
    return Promise.all(
      values.map((value) => this.resolve(value).then((resolved) => resolved ?? value)),
    );
  }

  /** Deduped batch resolve — one presign per unique storage key. */
  async resolveManyUnique(values: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
    if (unique.length === 0) return new Map();
    const resolved = await Promise.all(unique.map((value) => this.resolve(value)));
    const out = new Map<string, string>();
    unique.forEach((key, index) => {
      out.set(key, resolved[index] ?? key);
    });
    return out;
  }
}
