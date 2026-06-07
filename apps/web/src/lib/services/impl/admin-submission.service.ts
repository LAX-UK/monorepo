import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceSuccess } from "../http/service-result";
import type {
  ApproveSubmissionBody,
  ApproveSubmissionResult,
  ConvertSubmissionResult,
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

  async accept(
    id: string,
    body: ApproveSubmissionBody,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/submissions/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async convert(
    id: string,
    body: ApproveSubmissionBody,
  ): Promise<ServiceResult<ConvertSubmissionResult>> {
    const r = await this.api.json<unknown>(`/submissions/${encodeURIComponent(id)}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return r;
    type ConvertPayload = {
      data?: { lot?: { id?: string }; readinessPercent?: number };
    };
    const payload = r.data as ConvertPayload;
    const lotId = payload.data?.lot?.id ?? readLotIdFromApprove(r.data);
    const out: ConvertSubmissionResult = { lotId: lotId ?? undefined };
    if (payload.data?.readinessPercent !== undefined) {
      out.readinessPercent = payload.data.readinessPercent;
    }
    return serviceSuccess(out, r.status);
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

  async assign(
    id: string,
    assignedToUserId: string | null,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    return this.api.json<Record<string, unknown>>(`/submissions/${encodeURIComponent(id)}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToUserId }),
    });
  }
}
