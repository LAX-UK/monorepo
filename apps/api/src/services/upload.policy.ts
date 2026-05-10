import { randomUUID } from "node:crypto";
import type { UserRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";

export const uploadKinds = [
  "avatar",
  "submission_image",
  "lot_image",
  "sale_cover",
  "legal_entity_document",
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
  legal_entity_document: {
    maxBytes: 15 * 1024 * 1024,
    allowedContentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    keyPrefix: "uploads/pending/legal-entity-documents",
  },
};

export function isUploadKind(value: string): value is UploadKind {
  return (uploadKinds as readonly string[]).includes(value);
}

export function canUploadKind(kind: UploadKind, role: UserRole): boolean {
  switch (kind) {
    case "avatar":
      return true;
    case "submission_image":
      return (
        roleHasCapability(role, "client.submit") || roleHasCapability(role, "platform.admin.full")
      );
    case "lot_image":
    case "sale_cover":
      return roleHasCapability(role, "platform.admin.full");
    case "legal_entity_document":
      return (
        roleHasCapability(role, "client.submit") || roleHasCapability(role, "platform.admin.full")
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
