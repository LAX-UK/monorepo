import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  CreateArtistInput,
  IAdminArtistService,
  UpdateArtistInput,
} from "../interfaces/admin-artist-service";

function readArtistId(body: unknown): string | undefined {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: { id?: string } }).data?.id;
  }
  return undefined;
}

export class AdminArtistService implements IAdminArtistService {
  constructor(private readonly api: IAuthedApiClient) {}

  async create(input: CreateArtistInput): Promise<ServiceResult<{ id: string }>> {
    const r = await this.api.json<unknown>("/admin/artists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const id = readArtistId(r.data);
    if (!id)
      return { ok: false, message: "Create failed: missing id", status: r.status, body: r.data };
    return serviceSuccess({ id }, r.status);
  }

  async update(
    id: string,
    input: UpdateArtistInput,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/admin/artists/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
}
