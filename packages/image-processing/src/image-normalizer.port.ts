export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

export type NormalizedImage = {
  bytes: Buffer;
  contentType: ImageFormat;
  /** Dimensions as the source file declares them, before orientation is applied. */
  original: { width: number; height: number; bytes: number };
  /** Dimensions and size of what will be stored, after orientation and any downscale. */
  stored: { width: number; height: number; bytes: number };
};

/**
 * Prepares a fetched image for storage: applies EXIF orientation, strips location
 * data and scales oversized files down in their own format. Throws when the bytes
 * are not a decodable image.
 */
export type ImageNormalizerPort = {
  normalize(bytes: Buffer, contentType: ImageFormat): Promise<NormalizedImage>;
};
