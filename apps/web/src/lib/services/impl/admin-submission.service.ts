import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  ApproveSubmissionBody,
  ApproveSubmissionResult,
  IAdminSubmissionService,
  RejectSubmissionBody,
} from "../interfaces/admin-submission-service";

function readLotIdFromApprove(body: unknown): string | undefined {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data?: { lot?: { id?: string } } }).data?.lot?.id;
  }
  return undefined;
}

export class AdminSubmissionService implements IAdminSubmissionService {
  constructor(private readonly api: IAuthedApiClient) {}

  async startReview(id: string): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(
      `/submissions/${encodeURIComponent(id)}/review/start`,
      { method: "POST" },
    );
  }

  async approve(
    id: string,
    body: ApproveSubmissionBody,
  ): Promise<ServiceResult<ApproveSubmissionResult>> {
    const r = await this.api.json<unknown>(`/submissions/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return r;
    const lotId = readLotIdFromApprove(r.data);
    return serviceSuccess({ lotId: lotId ?? undefined }, r.status);
  }

  async reject(
    id: string,
    body: RejectSubmissionBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/submissions/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
