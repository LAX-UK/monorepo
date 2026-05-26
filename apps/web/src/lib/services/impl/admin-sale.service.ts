import type { LotStatus } from "@auction/types";
import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  CancelSaleBody,
  CreateNestedLotForSaleInput,
  CreateSaleInput,
  IAdminSaleService,
  MarkSaleEndedBody,
  UpdateSaleInput,
} from "../interfaces/admin-sale-service";

function readEntityId(body: unknown): string | undefined {
  if (body && typeof body === "object" && "data" in body) {
    const data = (body as { data?: { id?: string } }).data;
    if (data && typeof data.id === "string") return data.id;
  }
  return undefined;
}

export class AdminSaleService implements IAdminSaleService {
  constructor(private readonly api: IAuthedApiClient) {}

  async create(input: CreateSaleInput): Promise<ServiceResult<{ id: string }>> {
    const r = await this.api.json<unknown>("/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const id = readEntityId(r.data);
    if (!id)
      return { ok: false, message: "Create failed: missing id", status: r.status, body: r.data };
    return serviceSuccess({ id }, r.status);
  }

  async update(
    id: string,
    input: UpdateSaleInput,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/sales/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async publish(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/sales/${encodeURIComponent(id)}/publish`, {
      method: "POST",
    });
  }

  async unpublish(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/sales/${encodeURIComponent(id)}/unpublish`, {
      method: "POST",
    });
  }

  async cancel(id: string, _body: CancelSaleBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/sales/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }

  async softDelete(id: string, confirmationPhrase: string): Promise<ServiceResult<void>> {
    return this.api.json<void>(`/sales/${encodeURIComponent(id)}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase }),
    });
  }

  async createNestedLot(
    saleId: string,
    input: CreateNestedLotForSaleInput,
  ): Promise<ServiceResult<{ id: string }>> {
    const r = await this.api.json<unknown>(`/sales/${encodeURIComponent(saleId)}/lots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const id = readEntityId(r.data);
    if (!id) {
      return {
        ok: false,
        message: "Create failed: missing lot id",
        status: r.status,
        body: r.data,
      };
    }
    return serviceSuccess({ id }, r.status);
  }

  async attachLot(saleId: string, lotId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/sales/${encodeURIComponent(saleId)}/lots/attach/${encodeURIComponent(lotId)}`,
      { method: "POST" },
    );
  }

  async detachLot(saleId: string, lotId: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/sales/${encodeURIComponent(saleId)}/lots/${encodeURIComponent(lotId)}`,
      { method: "DELETE" },
    );
  }

  async markEnded(
    id: string,
    body: MarkSaleEndedBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/sales/${encodeURIComponent(id)}/mark-ended`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async cancelLot(
    saleId: string,
    lotId: string,
    body: CancelSaleBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/sales/${encodeURIComponent(saleId)}/lots/${encodeURIComponent(lotId)}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      },
    );
  }

  async setLotStatus(
    saleId: string,
    lotId: string,
    status: LotStatus,
    reason?: string,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/sales/${encodeURIComponent(saleId)}/lots/${encodeURIComponent(lotId)}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      },
    );
  }
}
