import { randomUUID } from "node:crypto";
import {
  ARTIST_APPLICATION_IMAGE_MAX_BYTES,
  ARTIST_APPLICATION_IMAGE_TYPES,
} from "@auction/shop-contracts";

export const SHOP_MEDIA_KINDS = [
  "artwork_image",
  "artist_portrait",
  "artist_hero",
  "editorial_cover",
  "editorial_inline",
  "venue_image",
  "artist_application_image",
] as const;

export type ShopMediaKind = (typeof SHOP_MEDIA_KINDS)[number];

/** Kinds staff upload in LAX Admin. Application images arrive only through an artist's own form. */
export const STAFF_MEDIA_KINDS = SHOP_MEDIA_KINDS.filter(
  (kind): kind is Exclude<ShopMediaKind, "artist_application_image"> =>
    kind !== "artist_application_image",
);

const POLICIES: Record<
  ShopMediaKind,
  { maxBytes: number; allowedContentTypes: readonly string[]; keyPrefix: string }
> = {
  artwork_image: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "shop/artwork",
  },
  artist_portrait: {
    maxBytes: 5 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "shop/artist-portrait",
  },
  artist_hero: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "shop/artist-hero",
  },
  editorial_cover: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "shop/editorial-cover",
  },
  editorial_inline: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "shop/editorial-inline",
  },
  venue_image: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "shop/venue",
  },
  // Sent by artists applying to the gallery: the same image rules as artworks, its own prefix.
  artist_application_image: {
    maxBytes: ARTIST_APPLICATION_IMAGE_MAX_BYTES,
    allowedContentTypes: ARTIST_APPLICATION_IMAGE_TYPES,
    keyPrefix: "shop/artist-application",
  },
};

export function shopMediaPolicy(kind: ShopMediaKind) {
  return POLICIES[kind];
}

export function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export function buildShopMediaObjectKey(kind: ShopMediaKind, contentType: string): string {
  const policy = shopMediaPolicy(kind);
  const ext = extensionForContentType(contentType);
  return `${policy.keyPrefix}/${randomUUID()}.${ext}`;
}

export const SHOP_MEDIA_PRESIGN_TTL_SEC = 5 * 60;

/** Magic-byte sniff for the first bytes of an image upload. */
export function matchesDeclaredImageType(contentType: string, bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (contentType === "image/webp") {
    const riff = bytes.subarray(0, 4).toString("ascii") === "RIFF";
    const webp = bytes.subarray(8, 12).toString("ascii") === "WEBP";
    return riff && webp;
  }
  return false;
}
