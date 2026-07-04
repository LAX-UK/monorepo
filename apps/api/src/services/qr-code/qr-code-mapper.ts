import type { QrCodeRow } from "@auction/persistence/interfaces";
import type { QrCodeDto, QrCodeEntityType, QrCodeStatus } from "./qr-code-types.js";

export function toQrCodeDto(row: QrCodeRow, destinationPath: string, webOrigin: string): QrCodeDto {
  return {
    id: row.id,
    shortCode: row.shortCode,
    shortUrl: `${webOrigin.replace(/\/$/, "")}/q/${row.shortCode}`,
    entityType: row.entityType,
    entityId: row.entityId,
    destinationUrl: absoluteWebUrl(webOrigin, destinationPath),
    campaign: row.campaign,
    placement: row.placement,
    status: row.status,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function absoluteWebUrl(webOrigin: string, path: string): string {
  return `${webOrigin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export type QrCodeUpdateInput = {
  campaign?: string | null | undefined;
  placement?: string | null | undefined;
  status?: QrCodeStatus | undefined;
  expiresAt?: string | null | undefined;
};

export function toUpdatePatch(input: QrCodeUpdateInput) {
  const patch: {
    campaign?: string | null;
    placement?: string | null;
    status?: QrCodeStatus;
    expiresAt?: Date | null;
  } = {};
  if ("campaign" in input) patch.campaign = input.campaign ?? null;
  if ("placement" in input) patch.placement = input.placement ?? null;
  if (input.status) patch.status = input.status;
  if ("expiresAt" in input) patch.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  return patch;
}

export type { QrCodeEntityType };
