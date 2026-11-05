/** Where in Zoho a picture is kept. The record image is the one on the Product itself. */
export type ZohoImageOrigin = "record_image" | "attachment";

/**
 * One picture Zoho holds for a Product, as listed (not yet downloaded). `fingerprint` changes
 * whenever Zoho's file changes, so an unchanged picture is recognised without fetching it.
 */
export type RemoteProductImage = {
  /** `record_image` for the Product's own image, otherwise the attachment id. */
  fileId: string;
  fingerprint: string;
  origin: ZohoImageOrigin;
  fileName: string | null;
};

/** Zoho refused or could not give a file. `retryable` says whether a later pass may succeed. */
export class ZohoImageFetchError extends Error {
  constructor(
    readonly reason: "not_found" | "too_large" | "unavailable",
    readonly retryable: boolean,
    message?: string,
  ) {
    super(message ?? `zoho_image_${reason}`);
    this.name = "ZohoImageFetchError";
  }
}

/** Reads a Product's pictures from Zoho. The sync depends on this, never on Zoho's API. */
export interface ZohoProductImageGateway {
  /** The Product's pictures in the order the register keeps them: record image, then attachments. */
  listImages(productId: string): Promise<RemoteProductImage[]>;
  /** The file's bytes. Throws `ZohoImageFetchError` when Zoho refuses or the file is too big. */
  downloadImage(productId: string, image: RemoteProductImage, maxBytes: number): Promise<Buffer>;
}
