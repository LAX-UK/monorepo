import type { IObjectStorage } from "./interfaces/object-storage.js";

export type StorageReadMode = "public" | "signed";

export class MediaUrlResolver {
  constructor(
    private readonly storage: IObjectStorage,
    private readonly readMode: StorageReadMode,
    private readonly signedGetTtlSec: number,
  ) {}

  async resolve(value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    const key = this.storage.extractKey(value);
    if (!key) return value;
    if (this.readMode === "signed") {
      return (await this.storage.createPresignedGet({ key, expiresInSec: this.signedGetTtlSec }))
        .url;
    }
    return this.storage.getPublicUrl(key);
  }

  async resolveMany(values: readonly string[]): Promise<string[]> {
    return Promise.all(
      values.map((value) => this.resolve(value).then((resolved) => resolved ?? value)),
    );
  }
}
