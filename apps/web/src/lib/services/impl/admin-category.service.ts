import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  CreateCategoryInput,
  IAdminCategoryService,
  UpdateCategoryInput,
} from "../interfaces/admin-category-service";

function readCategoryId(body: unknown): string | undefined {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: { id?: string } }).data?.id;
  }
  return undefined;
}

export class AdminCategoryService implements IAdminCategoryService {
  constructor(private readonly api: IAuthedApiClient) {}

  async create(input: CreateCategoryInput): Promise<ServiceResult<{ id: string }>> {
    const r = await this.api.json<unknown>("/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const id = readCategoryId(r.data);
    if (!id) {
      return { ok: false, message: "Create failed: missing id", status: r.status, body: r.data };
    }
    return serviceSuccess({ id }, r.status);
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/admin/categories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async archive(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/admin/categories/${encodeURIComponent(id)}/archive`,
      { method: "POST" },
    );
  }

  async delete(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/admin/categories/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
