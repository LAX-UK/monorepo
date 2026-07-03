import { parseAdminCheckInCandidate } from "@/lib/data/http/admin.server";
import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type {
  AdminCheckInInput,
  AdminCheckInResult,
  AdminPaddlePlaceBidInput,
  IAdminPaddleService,
} from "../interfaces/admin-paddle-service";

function registrationPath(saleId: string, suffix: string): string {
  return `/admin/sales/${encodeURIComponent(saleId)}/registrations/${suffix}`;
}

export class AdminPaddleService implements IAdminPaddleService {
  constructor(private readonly api: IAuthedApiClient) {}

  async checkInCandidates(saleId: string, q: string) {
    const r = await this.api.json<{ data?: { items?: unknown[] } }>(
      `${registrationPath(saleId, "check-in-candidates")}?${new URLSearchParams({ q }).toString()}`,
      { cache: "no-store" },
    );
    if (!r.ok) return r;
    const items = (r.data?.data?.items ?? []).map((row) => parseAdminCheckInCandidate(row));
    return serviceSuccess({ items }, r.status);
  }

  async checkIn(input: AdminCheckInInput): Promise<ServiceResult<AdminCheckInResult>> {
    const r = await this.api.json<{
      data?: {
        registrationId?: string;
        paddleNumber?: number;
        checkedInAt?: string;
        bidLimit?: string;
      };
    }>(registrationPath(input.saleId, "check-in"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        assignPaddle: input.assignPaddle,
        ...(input.bidLimit != null ? { bidLimit: input.bidLimit } : {}),
        ...(input.paddleNumber != null ? { paddleNumber: input.paddleNumber } : {}),
      }),
    });
    if (!r.ok) return r;
    const data = r.data?.data;
    if (!data?.registrationId || !data.checkedInAt) {
      return serviceFailure("Unexpected response from server", r.status, r.data);
    }
    return serviceSuccess(
      {
        registrationId: data.registrationId,
        paddleNumber: data.paddleNumber ?? null,
        checkedInAt: data.checkedInAt,
        ...(data.bidLimit != null ? { bidLimit: data.bidLimit } : {}),
      },
      r.status,
    );
  }

  async assignPaddle(saleId: string, registrationId: string, paddleNumber?: number) {
    const r = await this.api.json<{ data?: { paddleNumber?: number } }>(
      `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/paddle`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paddleNumber != null ? { paddleNumber } : {}),
      },
    );
    if (!r.ok) return r;
    const assigned = r.data?.data?.paddleNumber;
    if (assigned == null) {
      return serviceFailure("Unexpected response from server", r.status, r.data);
    }
    return serviceSuccess({ paddleNumber: assigned }, r.status);
  }

  async clearPaddle(saleId: string, registrationId: string) {
    const r = await this.api.json<unknown>(
      `/admin/sales/${encodeURIComponent(saleId)}/registrations/${encodeURIComponent(registrationId)}/paddle`,
      { method: "DELETE" },
    );
    return r.ok ? serviceSuccess({ ok: true as const }, r.status) : r;
  }

  async placeBid(input: AdminPaddlePlaceBidInput) {
    const r = await this.api.json<{ data?: { id?: string } }>("/admin/saleroom/paddle-bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saleId: input.saleId,
        lotId: input.lotId,
        paddleNumber: input.paddleNumber,
        amount: input.amount,
        ...(input.maxAutoBidAmount != null ? { maxAutoBidAmount: input.maxAutoBidAmount } : {}),
      }),
    });
    if (!r.ok) return r;
    const bidId = r.data?.data?.id;
    if (!bidId) {
      return serviceFailure("Unexpected response from server", r.status, r.data);
    }
    return serviceSuccess({ bidId }, r.status);
  }
}
