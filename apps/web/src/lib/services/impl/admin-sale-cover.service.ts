import type { SaleCoverSlotName } from "@auction/types";
import type {
  ReplaceHomePinsBody,
  SetSaleCoverSlotBody,
  UpdateSaleHomeBody,
} from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { IAdminSaleCoverService } from "../interfaces/admin-sale-cover-service";

const JSON_HEADERS = { "Content-Type": "application/json" };

export class AdminSaleCoverService implements IAdminSaleCoverService {
  constructor(private readonly api: IAuthedApiClient) {}

  private slotPath(saleId: string, slot: SaleCoverSlotName): string {
    return `/admin/sales/${encodeURIComponent(saleId)}/cover/${slot}`;
  }

  setSlot(
    saleId: string,
    slot: SaleCoverSlotName,
    body: SetSaleCoverSlotBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(this.slotPath(saleId, slot), {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  }

  clearSlot(saleId: string, slot: SaleCoverSlotName): Promise<ServiceResult<void>> {
    return this.api.json<void>(this.slotPath(saleId, slot), { method: "DELETE" });
  }

  updateHome(
    saleId: string,
    body: UpdateSaleHomeBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/sales/${encodeURIComponent(saleId)}/home`,
      {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      },
    );
  }

  replacePins(body: ReplaceHomePinsBody): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>("/admin/home-pins", {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  }
}
