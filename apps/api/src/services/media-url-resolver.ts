import type { IObjectStorage } from "./interfaces/object-storage.js";
import type { ISignedUrlPolicy } from "./signed-url-policy.js";
import { PerRequestSigningPolicy } from "./signed-url-policy.js";

export type StorageReadMode = "public" | "signed";

export class MediaUrlResolver {
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
}
