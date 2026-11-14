import type { FinanceHttpJson } from "./finance-route-http.js";

/** A Books workflow notice as the route received it: nothing parsed, nothing trusted yet. */
export interface ZohoBooksNoticeRequest {
  readonly rawBody: string;
  /** The request's query parameters, in the order received (they are signed too). */
  readonly params: readonly (readonly [string, string])[];
  readonly signature: string | undefined;
}

export interface IZohoBooksNoticeIngressApplicationService {
  handle(request: ZohoBooksNoticeRequest): Promise<FinanceHttpJson>;
}
