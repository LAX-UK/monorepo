import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  BulkLotsBody,
  CancelLotBody,
  CreateLotInput,
  IAdminLotService,
  ReturnLotToInventoryBody,
  UpdateLotInput,
  UpdateLotMarketingDetailsInput,
} from "../interfaces/admin-lot-service";

function readLotId(body: unknown): string | undefined {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: { id?: string } }).data?.id;
  }
  return undefined;
}

export class AdminLotService implements IAdminLotService {
  constructor(private readonly api: IAuthedApiClient) {}

  async create(input: CreateLotInput): Promise<ServiceResult<{ id: string }>> {
    const r = await this.api.json<unknown>("/lots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const id = readLotId(r.data);
    if (!id)
      return { ok: false, message: "Create failed: missing id", status: r.status, body: r.data };
    return serviceSuccess({ id }, r.status);
  }

  async update(id: string, input: UpdateLotInput): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/lots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async updateMarketingDetails(
    id: string,
    input: UpdateLotMarketingDetailsInput,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/lots/${encodeURIComponent(id)}/marketing-details`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
  }

  async publish(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/lots/${encodeURIComponent(id)}/publish`, {
      method: "POST",
    });
  }

  async cancel(id: string, body: CancelLotBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/lots/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async softDelete(id: string, confirmationPhrase: string): Promise<ServiceResult<void>> {
    return this.api.json<void>(`/lots/${encodeURIComponent(id)}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationPhrase }),
    });
  }

  async bulk(body: BulkLotsBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/lots/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async returnToInventory(
    id: string,
    body: ReturnLotToInventoryBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/lots/${encodeURIComponent(id)}/return-to-inventory`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async approveWithdrawalRequest(id: string): Promise<ServiceResult<void>> {
    return this.api.json<void>(`/admin/lots/${encodeURIComponent(id)}/approve-withdrawal-request`, {
      method: "POST",
    });
  }
}
