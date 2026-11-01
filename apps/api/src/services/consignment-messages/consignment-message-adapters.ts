import type { IObjectStorage } from "../interfaces/object-storage.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { IAttachmentLinks, IImageLinks } from "./consignment-message.ports.js";

/** Object links as the documents use them: public, or signed when storage is private. */
export class StorageAttachmentLinks implements IAttachmentLinks {
  constructor(
    private readonly storage: Pick<IObjectStorage, "getPublicUrl">,
    private readonly media: Pick<MediaUrlResolver, "resolveMany"> | undefined,
  ) {}

  async linksFor(keys: readonly string[]): Promise<string[]> {
    const bases = keys.map((key) => this.storage.getPublicUrl(key));
    return this.media ? this.media.resolveMany(bases) : bases;
  }
}

/** Photos of a consignment as the rest of the app shows them, whether stored as keys or links. */
export class ImageLinks implements IImageLinks {
  constructor(private readonly media: Pick<MediaUrlResolver, "resolveMany"> | undefined) {}

  async resolveAll(values: readonly string[]): Promise<string[]> {
    return this.media ? this.media.resolveMany(values) : [...values];
  }
}
