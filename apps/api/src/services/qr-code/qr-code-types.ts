export type QrCodeEntityType = "sale" | "lot";
export type QrCodeStatus = "active" | "disabled";

export type QrCodeDto = {
  id: string;
  shortCode: string;
  shortUrl: string;
  entityType: QrCodeEntityType;
  entityId: string;
  destinationUrl: string;
  campaign: string | null;
  placement: string | null;
  status: QrCodeStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QrCodeResolveResult =
  | { ok: true; qrCodeId: string; destinationUrl: string }
  | { ok: false; status: 404 | 410; reason: "not_found" | "inactive" | "expired" };

export type QrCodeCachedResolve = {
  qrCodeId: string;
  destinationUrl: string;
  status: QrCodeStatus;
  expiresAt: string | null;
};

export type QrCodeEntityRef = {
  title: string;
  destinationPath: string;
};
