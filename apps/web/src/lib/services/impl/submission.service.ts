import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  CreateItemSubmissionInput,
  CreateSubmissionData,
  ISubmissionService,
  UpdateItemSubmissionInput,
} from "../interfaces/submission-service";

function readIdFromPayload(body: unknown): string | undefined {
  if (body && typeof body === "object" && "data" in body) {
    const data = (body as { data?: { id?: string } }).data;
    return data?.id;
  }
  return undefined;
}

export class SubmissionService implements ISubmissionService {
  constructor(private readonly api: IAuthedApiClient) {}

  async create(input: CreateItemSubmissionInput): Promise<ServiceResult<CreateSubmissionData>> {
    const r = await this.api.json<unknown>("/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return r;
    const id = readIdFromPayload(r.data);
    if (!id)
      return { ok: false, message: "Create failed: missing id", status: r.status, body: r.data };
    return serviceSuccess({ id }, r.status);
  }

  async update(
    id: string,
    input: UpdateItemSubmissionInput,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/submissions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }

  async submitForReview(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/submissions/${encodeURIComponent(id)}/submit`, {
      method: "POST",
    });
  }

  async withdraw(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/submissions/${encodeURIComponent(id)}/withdraw`,
      { method: "POST" },
    );
  }
}
