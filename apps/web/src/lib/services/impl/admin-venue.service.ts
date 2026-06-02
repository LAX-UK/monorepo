import type { CreateVenueInput, UpdateVenueInput, Venue } from "@auction/types";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import { serviceSuccess } from "../http/service-result";
import type {
  AdminVenueListResult,
  AdminVenueListRow,
  IAdminVenueService,
  VenueDetail,
} from "../interfaces/admin-venue-service";

function readData<T>(body: unknown): T | null {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: T }).data ?? null;
  }
  return null;
}

function readTotal(body: unknown): number | null {
  if (body && typeof body === "object" && "total" in body) {
    const total = (body as { total?: unknown }).total;
    return typeof total === "number" && Number.isFinite(total) ? total : null;
  }
  return null;
}

export class AdminVenueService implements IAdminVenueService {
  constructor(private readonly api: IAuthedApiClient) {}

  async list(
    input: {
      legalEntityId?: string;
      includeArchived?: boolean;
      q?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<ServiceResult<AdminVenueListResult>> {
    const params = new URLSearchParams();
    if (input.legalEntityId) params.set("legalEntityId", input.legalEntityId);
    if (input.includeArchived) params.set("includeArchived", "1");
    if (input.q?.trim()) params.set("q", input.q.trim());
    if (input.limit != null) params.set("limit", String(input.limit));
    if (input.offset != null) params.set("offset", String(input.offset));
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const r = await this.api.json<unknown>(`/venues${suffix}`);
    if (!r.ok) return r;
    const rawVenues = readData<(Venue & { legalEntityDisplayName?: unknown })[]>(r.data) ?? [];
    const venues: AdminVenueListRow[] = rawVenues.map((v) => {
      const extra = v as Venue & {
        legalEntityDisplayName?: unknown;
        legal_entity_display_name?: unknown;
      };
      const fromApi =
        typeof extra.legalEntityDisplayName === "string"
          ? extra.legalEntityDisplayName
          : typeof extra.legal_entity_display_name === "string"
            ? extra.legal_entity_display_name
            : null;
      return {
        ...v,
        legalEntityDisplayName: fromApi?.trim() || null,
      };
    });
    const total = readTotal(r.data) ?? venues.length;
    return serviceSuccess({ venues, total }, r.status);
  }

  async create(input: CreateVenueInput): Promise<ServiceResult<Venue>> {
    const r = await this.api.json<unknown>("/venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const data = readData<Venue>(r.data);
    if (!data) return { ok: false, message: "Create failed: missing venue", status: r.status };
    return serviceSuccess(data, r.status);
  }

  async get(id: string): Promise<ServiceResult<Venue>> {
    const r = await this.api.json<unknown>(`/venues/${encodeURIComponent(id)}`);
    if (!r.ok) return r;
    const data = readData<Venue>(r.data);
    if (!data) return { ok: false, message: "Load failed: missing venue", status: r.status };
    return serviceSuccess(data, r.status);
  }

  async getDetail(id: string): Promise<ServiceResult<VenueDetail>> {
    const r = await this.api.json<unknown>(`/venues/${encodeURIComponent(id)}`);
    if (!r.ok) return r;
    const venue = readData<Venue>(r.data);
    if (!venue) return { ok: false, message: "Load failed: missing venue", status: r.status };
    const usageRaw = (r.data as { usage?: { salesUsingCount?: number } } | null)?.usage;
    const salesUsingCount =
      typeof usageRaw?.salesUsingCount === "number" ? usageRaw.salesUsingCount : 0;
    return serviceSuccess({ venue, salesUsingCount }, r.status);
  }

  async update(id: string, input: UpdateVenueInput): Promise<ServiceResult<Venue>> {
    const r = await this.api.json<unknown>(`/venues/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const data = readData<Venue>(r.data);
    if (!data) return { ok: false, message: "Update failed: missing venue", status: r.status };
    return serviceSuccess(data, r.status);
  }

  async archive(id: string): Promise<ServiceResult<Venue>> {
    const r = await this.api.json<unknown>(`/venues/${encodeURIComponent(id)}/archive`, {
      method: "POST",
    });
    if (!r.ok) return r;
    const data = readData<Venue>(r.data);
    if (!data) return { ok: false, message: "Archive failed: missing venue", status: r.status };
    return serviceSuccess(data, r.status);
  }
}
