import { formatUploadMaxSize } from "@/lib/upload-limits";

/** Image upload kinds used by admin catalog and form media fields. */
export type CatalogImageUploadKind =
  | "avatar"
  | "submission_image"
  | "lot_image"
  | "sale_cover"
  | "sale_day"
  | "artist_image"
  | "category_image";

type CatalogImagePolicy = {
  accept: string;
  maxBytes: number;
  dropzoneTitle: string;
  dropzoneAriaLabel: string;
  placeholderLabel: string;
  helperCopy: string;
};

/** Client mirror of `uploadPolicies` in apps/api — keep MIME/size copy aligned. */
const CATALOG_IMAGE_POLICIES: Record<CatalogImageUploadKind, CatalogImagePolicy> = {
  avatar: {
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 2 * 1024 * 1024,
    dropzoneTitle: "Add profile photo",
    dropzoneAriaLabel: "Upload profile photo",
    placeholderLabel: "Profile",
    helperCopy: `JPEG, PNG, or WebP up to ${formatUploadMaxSize(2 * 1024 * 1024)}.`,
  },
  submission_image: {
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    dropzoneTitle: "Add submission images",
    dropzoneAriaLabel: "Upload submission images",
    placeholderLabel: "Submission image",
    helperCopy: `JPEG, PNG, or WebP up to ${formatUploadMaxSize(10 * 1024 * 1024)} each.`,
  },
  lot_image: {
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    dropzoneTitle: "Add catalogue images",
    dropzoneAriaLabel: "Upload lot images",
    placeholderLabel: "Lot artwork",
    helperCopy: `JPEG, PNG, or WebP up to ${formatUploadMaxSize(10 * 1024 * 1024)} each.`,
  },
  sale_cover: {
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    dropzoneTitle: "Add cover images",
    dropzoneAriaLabel: "Upload sale cover images",
    placeholderLabel: "Auction cover",
    helperCopy: `JPEG, PNG, or WebP up to ${formatUploadMaxSize(10 * 1024 * 1024)} each.`,
  },
  sale_day: {
    accept: "image/jpeg,image/png,image/webp,video/mp4,video/webm",
    maxBytes: 200 * 1024 * 1024,
    dropzoneTitle: "Add photos and videos",
    dropzoneAriaLabel: "Upload auction day media",
    placeholderLabel: "Auction day media",
    helperCopy: `JPEG, PNG, WebP, MP4, or WebM up to ${formatUploadMaxSize(200 * 1024 * 1024)} per file.`,
  },
  artist_image: {
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    dropzoneTitle: "Add artist image",
    dropzoneAriaLabel: "Upload artist images",
    placeholderLabel: "Artist image",
    helperCopy: `JPEG, PNG, or WebP up to ${formatUploadMaxSize(10 * 1024 * 1024)}.`,
  },
  category_image: {
    accept: "image/jpeg,image/png,image/webp",
    maxBytes: 10 * 1024 * 1024,
    dropzoneTitle: "Add category hero",
    dropzoneAriaLabel: "Upload category hero image",
    placeholderLabel: "Category hero",
    helperCopy: `JPEG, PNG, or WebP up to ${formatUploadMaxSize(10 * 1024 * 1024)}.`,
  },
};

export function getCatalogImagePolicy(kind: CatalogImageUploadKind): CatalogImagePolicy {
  return CATALOG_IMAGE_POLICIES[kind];
}

export function catalogImageAccept(kind: CatalogImageUploadKind): string {
  return getCatalogImagePolicy(kind).accept;
}

export function catalogImageHelperCopy(kind: CatalogImageUploadKind, remaining?: number): string {
  const policy = getCatalogImagePolicy(kind);
  if (remaining !== undefined) {
    return `${policy.helperCopy} ${remaining} remaining.`;
  }
  return policy.helperCopy;
}
