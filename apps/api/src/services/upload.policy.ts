import { randomUUID } from "node:crypto";
import type { UserRole, UserStaffRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";

export const uploadKinds = [
  "avatar",
  "submission_image",
  "lot_image",
  "sale_cover",
  "sale_day",
  "legal_entity_document",
  "lot_document",
  "sale_document",
  "submission_document",
  "source_of_funds_document",
  "artist_image",
  "category_image",
] as const;
export type UploadKind = (typeof uploadKinds)[number];

type UploadPolicy = {
  maxBytes: number;
  allowedContentTypes: readonly string[];
  keyPrefix: string;
};

export const uploadPolicies: Record<UploadKind, UploadPolicy> = {
  avatar: {
    maxBytes: 2 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/avatar",
  },
  submission_image: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/submissions",
  },
  lot_image: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/lots",
  },
  sale_cover: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/sales",
  },
  sale_day: {
    /** Photos up to 15 MB, short video clips up to 200 MB. */
    maxBytes: 200 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"],
    keyPrefix: "uploads/pending/sale-day",
  },
  legal_entity_document: {
    maxBytes: 15 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/legal-entity-documents",
  },
  lot_document: {
    maxBytes: 25 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/lot-documents",
  },
  sale_document: {
    maxBytes: 25 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/sale-documents",
  },
  submission_document: {
    maxBytes: 25 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/submission-documents",
  },
  source_of_funds_document: {
    maxBytes: 25 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/source-of-funds",
  },
  artist_image: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/artists",
  },
  category_image: {
    maxBytes: 10 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/categories",
  },
};

export function isUploadKind(value: string): value is UploadKind {
  return (uploadKinds as readonly string[]).includes(value);
}

export function canUploadKind(
  kind: UploadKind,
  role: UserRole,
  staffRole?: UserStaffRole | null,
): boolean {
  switch (kind) {
    case "avatar":
      return true;
    case "submission_image":
      return (
        roleHasCapability(role, "client.submit", staffRole) ||
        roleHasCapability(role, "legal_entity.read", staffRole)
      );
    case "lot_image":
    case "sale_cover":
    case "sale_day":
      return (
        roleHasCapability(role, "platform.admin.full", staffRole) ||
        roleHasCapability(role, "auction.manage", staffRole) ||
        roleHasCapability(role, "catalogue.write", staffRole)
      );
    case "legal_entity_document":
      return (
        roleHasCapability(role, "client.submit", staffRole) ||
        roleHasCapability(role, "legal_entity.read", staffRole)
      );
    case "lot_document":
    case "sale_document":
      return (
        roleHasCapability(role, "platform.admin.full", staffRole) ||
        roleHasCapability(role, "auction.manage", staffRole) ||
        roleHasCapability(role, "catalogue.write", staffRole)
      );
    case "submission_document":
      return (
        roleHasCapability(role, "platform.admin.full", staffRole) ||
        roleHasCapability(role, "auction.manage", staffRole) ||
        roleHasCapability(role, "catalogue.write", staffRole)
      );
    case "source_of_funds_document":
      return (
        roleHasCapability(role, "client.read", staffRole) ||
        roleHasCapability(role, "aml.review", staffRole) ||
        roleHasCapability(role, "platform.admin.full", staffRole)
      );
    case "artist_image":
    case "category_image":
      return (
        roleHasCapability(role, "platform.admin.full", staffRole) ||
        roleHasCapability(role, "auction.manage", staffRole) ||
        roleHasCapability(role, "catalogue.write", staffRole)
      );
  }
}

export function extForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}

export function createUploadKey(kind: UploadKind, userId: string, contentType: string): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${uploadPolicies[kind].keyPrefix}/${safeUserId}/${randomUUID()}${extForContentType(contentType)}`;
}

export function sniffImageContentType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
