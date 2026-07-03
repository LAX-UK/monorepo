import type { QrCodeAnalyticsClientQuery, QrCodeDetailedAnalytics } from "@auction/validators";
import type { ServiceResult } from "../http/service-result";

export type AdminQrCodeItem = {
  id: string;
  shortCode: string;
  shortUrl: string;
  destinationUrl: string;
  status: "active" | "disabled";
  campaign: string | null;
  placement: string | null;
};

export type AdminQrCodeEntityQuery = {
  entityType: "sale" | "lot";
  entityId: string;
};

export type AdminQrCodeCreateInput = AdminQrCodeEntityQuery & {
  placement: string;
};

export interface IAdminQrCodesService {
  list(input: AdminQrCodeEntityQuery): Promise<ServiceResult<AdminQrCodeItem[]>>;
  create(input: AdminQrCodeCreateInput): Promise<ServiceResult<AdminQrCodeItem>>;
  regenerate(input: AdminQrCodeEntityQuery): Promise<ServiceResult<AdminQrCodeItem>>;
  getAnalytics(
    qrCodeId: string,
    query: QrCodeAnalyticsClientQuery,
  ): Promise<ServiceResult<QrCodeDetailedAnalytics>>;
}
