import type { QrCodeScanJobPayload } from "@auction/queues";
import type {
  QrCodeDto,
  QrCodeEntityType,
  QrCodeResolveResult,
  QrCodeStatus,
} from "../qr-code/qr-code-types.js";

export type { QrCodeDto, QrCodeEntityType, QrCodeStatus } from "../qr-code/qr-code-types.js";

export interface IQrCodeAdminService {
  getOrCreateDefault(input: {
    entityType: QrCodeEntityType;
    entityId: string;
    actorUserId?: string | null;
  }): Promise<{ item: QrCodeDto; created: boolean } | null>;

  listForEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeDto[]>;

  update(
    id: string,
    patch: {
      campaign?: string | null | undefined;
      placement?: string | null | undefined;
      status?: QrCodeStatus | undefined;
      expiresAt?: string | null | undefined;
    },
  ): Promise<QrCodeDto | null>;

  regenerateDefault(input: {
    entityType: QrCodeEntityType;
    entityId: string;
    actorUserId?: string | null;
  }): Promise<QrCodeDto | null>;
}

export interface IQrCodePublicResolveService {
  resolve(shortCode: string): Promise<QrCodeResolveResult>;
  enqueueScan(input: QrCodeScanJobPayload): Promise<void>;
}

/** Composite QR service — prefer narrow ports for new callers. */
export interface IQrCodeService extends IQrCodeAdminService, IQrCodePublicResolveService {}
