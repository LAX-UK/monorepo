import type { QrCodeAnalyticsClientQuery, QrCodeDetailedAnalytics } from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type {
  AdminQrCodeCreateInput,
  AdminQrCodeEntityQuery,
  AdminQrCodeItem,
  IAdminQrCodesService,
} from "../interfaces/admin-qr-codes-service";

const skipEntityHeader = { skipActingLegalEntityHeader: true as const };

function readQrCodeItem(
  result: ServiceResult<{ data?: AdminQrCodeItem }>,
): ServiceResult<AdminQrCodeItem> {
  if (!result.ok) return result;
  const item = result.data?.data;
  if (!item) {
    return serviceFailure("invalid_response", result.status, result.data);
  }
  return serviceSuccess(item, result.status);
}

function readAnalytics(
  result: ServiceResult<{ data?: QrCodeDetailedAnalytics }>,
): ServiceResult<QrCodeDetailedAnalytics> {
  if (!result.ok) return result;
  const analytics = result.data?.data;
  if (!analytics) {
    return serviceFailure("Could not load QR analytics", result.status, result.data);
  }
  return serviceSuccess(analytics, result.status);
}

export class AdminQrCodesService implements IAdminQrCodesService {
  constructor(private readonly api: IAuthedApiClient) {}

  async list(input: AdminQrCodeEntityQuery) {
    const qs = new URLSearchParams(input);
    const r = await this.api.json<{ data?: { items?: AdminQrCodeItem[] } }>(
      `/admin/qr-codes?${qs}`,
      skipEntityHeader,
    );
    if (!r.ok) return r;
    return serviceSuccess(r.data?.data?.items ?? [], r.status);
  }

  async create(input: AdminQrCodeCreateInput) {
    return readQrCodeItem(
      await this.api.json<{ data?: AdminQrCodeItem }>("/admin/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        ...skipEntityHeader,
      }),
    );
  }

  async regenerate(input: AdminQrCodeEntityQuery) {
    return readQrCodeItem(
      await this.api.json<{ data?: AdminQrCodeItem }>("/admin/qr-codes/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        ...skipEntityHeader,
      }),
    );
  }

  async getAnalytics(qrCodeId: string, query: QrCodeAnalyticsClientQuery) {
    const qs = new URLSearchParams();
    if ("range" in query) {
      qs.set("range", query.range);
    } else {
      qs.set("from", query.from);
      qs.set("to", query.to);
    }
    return readAnalytics(
      await this.api.json<{ data?: QrCodeDetailedAnalytics }>(
        `/admin/qr-codes/${encodeURIComponent(qrCodeId)}/analytics?${qs}`,
        skipEntityHeader,
      ),
    );
  }
}
