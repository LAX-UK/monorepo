import {
  type CloseDataRequestInput,
  type CreateDataRequestInput,
  DATA_REQUESTS_MACHINE_SCOPE,
  type DataRequestListQuery,
  type ExtendDataRequestInput,
  type PatchDataRequestInput,
  dataRequestListSchema,
  dataRequestRecordSchema,
  dataRequestSummarySchema,
  dataRequestsPath,
} from "@auction/identity-contracts";
import type { z } from "zod";
import {
  type DataRequestOutcome,
  DataRequestsUnavailableError,
  type IIdentityDataRequestsClient,
} from "../services/interfaces/identity-data-requests-client.js";
import { IdentityMachineHttp, type MachineHttpResponse } from "./identity-machine-http.js";

/** Statuses Identity uses for a business refusal; anything else unexpected is an outage. */
const REFUSAL_STATUSES = new Set([400, 403, 404, 409, 422, 429]);

function parse<T>(schema: z.ZodType<T>, response: MachineHttpResponse): T {
  const parsed = schema.safeParse(response.body);
  if (!parsed.success) {
    throw new DataRequestsUnavailableError(
      "Identity returned an unexpected data requests response",
    );
  }
  return parsed.data;
}

function listQueryString(query: DataRequestListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return `?${params.toString()}`;
}

/**
 * The Bid API's client for Identity's `/internal/identity/data-requests` routes. It holds a
 * credential of its own scope, so a lifecycle or export credential is never used here and this
 * one is never used for them.
 */
export class HttpIdentityDataRequestsClient implements IIdentityDataRequestsClient {
  private readonly http: IdentityMachineHttp;

  constructor(options: {
    issuerBaseUrl: string;
    clientId?: string | undefined;
    clientSecret?: string | undefined;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  }) {
    this.http = new IdentityMachineHttp({ ...options, scope: DATA_REQUESTS_MACHINE_SCOPE });
  }

  async list(query: DataRequestListQuery) {
    const response = await this.http.request(
      "GET",
      `${dataRequestsPath()}${listQueryString(query)}`,
    );
    if (response.status !== 200) throw unexpected(response);
    return parse(dataRequestListSchema, response);
  }

  async summary() {
    const response = await this.http.request("GET", dataRequestsPath("summary"));
    if (response.status !== 200) throw unexpected(response);
    return parse(dataRequestSummarySchema, response);
  }

  async record(reference: string, actorSubjectId: string) {
    const query = new URLSearchParams({ actorSubjectId }).toString();
    return this.outcome(await this.http.request("GET", `${dataRequestsPath(reference)}?${query}`));
  }

  async create(input: CreateDataRequestInput) {
    return this.outcome(await this.http.request("POST", dataRequestsPath(), input));
  }

  async patch(reference: string, input: PatchDataRequestInput) {
    return this.outcome(await this.http.request("PATCH", dataRequestsPath(reference), input));
  }

  async extend(reference: string, input: ExtendDataRequestInput) {
    return this.outcome(
      await this.http.request("POST", dataRequestsPath(reference, "extend"), input),
    );
  }

  async close(reference: string, input: CloseDataRequestInput) {
    return this.outcome(
      await this.http.request("POST", dataRequestsPath(reference, "close"), input),
    );
  }

  async continueDownload(reference: string, actorSubjectId: string) {
    return this.outcome(
      await this.http.request("POST", dataRequestsPath(reference, "continue"), { actorSubjectId }),
    );
  }

  private outcome(
    response: MachineHttpResponse,
  ): DataRequestOutcome<z.infer<typeof dataRequestRecordSchema>> {
    if (response.status === 200 || response.status === 201) {
      return { ok: true, value: parse(dataRequestRecordSchema, response) };
    }
    if (REFUSAL_STATUSES.has(response.status)) {
      const error = (response.body as { error?: unknown } | undefined)?.error;
      return {
        ok: false,
        status: response.status,
        error: typeof error === "string" ? error : "refused",
      };
    }
    throw unexpected(response);
  }
}

function unexpected(response: MachineHttpResponse): DataRequestsUnavailableError {
  return new DataRequestsUnavailableError(`Identity answered ${response.status} for data requests`);
}
