import type { AdminSavedViewDto, AdminSavedViewListKey } from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type { IAdminSavedViewService } from "../interfaces/admin-saved-view-service";

const skipEntityHeader = { skipActingLegalEntityHeader: true as const };
const jsonHeaders = { "Content-Type": "application/json" };

function unwrapItems(
  result: ServiceResult<{ data?: { items?: AdminSavedViewDto[] } }>,
): ServiceResult<AdminSavedViewDto[]> {
  if (!result.ok) return result;
  const items = result.data?.data?.items;
  return items
    ? serviceSuccess(items, result.status)
    : serviceFailure("Could not load your views", result.status, result.data);
}

function unwrapOne(
  result: ServiceResult<{ data?: AdminSavedViewDto }>,
): ServiceResult<AdminSavedViewDto> {
  if (!result.ok) return result;
  const view = result.data?.data;
  return view
    ? serviceSuccess(view, result.status)
    : serviceFailure("Could not save the view", result.status, result.data);
}

export class AdminSavedViewService implements IAdminSavedViewService {
  constructor(private readonly api: IAuthedApiClient) {}

  async list(listKey: AdminSavedViewListKey) {
    return unwrapItems(
      await this.api.json(
        `/admin/saved-views?${new URLSearchParams({ listKey })}`,
        skipEntityHeader,
      ),
    );
  }

  async create(input: { listKey: AdminSavedViewListKey; label: string; query: string }) {
    return unwrapOne(
      await this.api.json("/admin/saved-views", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(input),
        ...skipEntityHeader,
      }),
    );
  }

  async rename(id: string, label: string) {
    return unwrapOne(
      await this.api.json(`/admin/saved-views/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ label }),
        ...skipEntityHeader,
      }),
    );
  }

  async reorder(listKey: AdminSavedViewListKey, ids: readonly string[]) {
    return unwrapItems(
      await this.api.json("/admin/saved-views/order", {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({ listKey, ids }),
        ...skipEntityHeader,
      }),
    );
  }

  async remove(id: string) {
    const result = await this.api.json<unknown>(`/admin/saved-views/${encodeURIComponent(id)}`, {
      method: "DELETE",
      ...skipEntityHeader,
    });
    return result.ok ? serviceSuccess(undefined, result.status) : result;
  }
}
