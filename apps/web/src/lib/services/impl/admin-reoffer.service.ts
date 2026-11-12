import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type { IAdminReofferService, StartedReoffer } from "../interfaces/admin-reoffer-service";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** The API wraps every answer as `{ data }`; the service hands back the data. */
function post<T>(api: IAuthedApiClient, path: string, body: unknown): Promise<ServiceResult<T>> {
  return api.json<T>(path, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export class AdminReofferService implements IAdminReofferService {
  constructor(private readonly api: IAuthedApiClient) {}

  async start(lotId: string, buyerDefaultId?: string): Promise<ServiceResult<StartedReoffer>> {
    const r = await post<{ data?: StartedReoffer }>(
      this.api,
      `/admin/lots/${encodeURIComponent(lotId)}/reoffers`,
      buyerDefaultId ? { buyerDefaultId } : {},
    );
    if (!r.ok) return r;
    const started = r.data.data;
    if (!started) return serviceFailure("The offer started but its status was missing", r.status);
    return serviceSuccess(started, r.status);
  }

  recordSellerAnswer(
    reofferId: string,
    body: Parameters<IAdminReofferService["recordSellerAnswer"]>[1],
  ) {
    return post<Record<string, unknown>>(
      this.api,
      `/admin/reoffers/${encodeURIComponent(reofferId)}/seller-answer`,
      body,
    );
  }

  send(reofferId: string, body: Parameters<IAdminReofferService["send"]>[1]) {
    return post<Record<string, unknown>>(
      this.api,
      `/admin/reoffers/${encodeURIComponent(reofferId)}/send`,
      body,
    );
  }

  withdraw(reofferId: string, body: Parameters<IAdminReofferService["withdraw"]>[1]) {
    return post<Record<string, unknown>>(
      this.api,
      `/admin/reoffers/${encodeURIComponent(reofferId)}/withdraw`,
      body,
    );
  }
}
