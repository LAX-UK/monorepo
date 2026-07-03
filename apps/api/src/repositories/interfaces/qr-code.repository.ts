import type { Database } from "@auction/db";
import type { QrCodeEntityType, QrCodeStatus } from "../../services/qr-code/qr-code-types.js";

export type QrCodeRow = {
  id: string;
  shortCode: string;
  entityType: QrCodeEntityType;
  entityId: string;
  campaign: string | null;
  placement: string | null;
  status: QrCodeStatus;
  expiresAt: Date | null;
  isDefault: boolean;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QrCodeInsert = {
  shortCode: string;
  entityType: QrCodeEntityType;
  entityId: string;
  isDefault?: boolean;
  createdByUserId?: string | null;
};

export type QrCodeUpdatePatch = {
  campaign?: string | null;
  placement?: string | null;
  status?: QrCodeStatus;
  expiresAt?: Date | null;
  isDefault?: boolean;
};

export type QrCodeEntityRef = {
  title: string;
  destinationPath: string;
};

export interface IQrCodeRepository {
  forConnection(conn: Database): IQrCodeRepository;
  findByShortCode(shortCode: string): Promise<QrCodeRow | null>;
  findDefaultForEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeRow | null>;
  listForEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeRow[]>;
  insert(row: QrCodeInsert): Promise<QrCodeRow>;
  update(id: string, patch: QrCodeUpdatePatch): Promise<QrCodeRow | null>;
  disableDefaultAndInsert(
    entityType: QrCodeEntityType,
    entityId: string,
    newRow: QrCodeInsert,
  ): Promise<{ row: QrCodeRow; oldShortCodes: string[] }>;
  loadEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeEntityRef | null>;
}
