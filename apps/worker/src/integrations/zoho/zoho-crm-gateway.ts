import type { WorkerEnv } from "../../env.js";
import type {
  CrmBatchUpsertInput,
  CrmConvertLeadInput,
  CrmConvertLeadResult,
  CrmDeleteRecordInput,
  CrmDeleteRecordResult,
  CrmGateway,
  CrmGatewayMetrics,
  CrmRecordResult,
  CrmSearchByEmailInput,
  CrmSearchByEmailResult,
  CrmUpdateByIdInput,
  CrmUpsertInput,
} from "../crm/crm-gateway.js";
import { getZohoCrmAccessToken, invalidateZohoCrmAccessToken } from "./oauth-token-refresh.js";
import { ZohoCrmAuthError, ZohoCrmHttpError } from "./types.js";
import { parseConvertLeadContactId } from "./zoho-crm-convert-response.js";
import { parseZohoRecordResponses } from "./zoho-crm-response.js";

export type ZohoCrmGatewayConfig = {
  apiHost: string;
  trigger: unknown[];
};

const ALREADY_DELETED_CODES = new Set(["INVALID_DATA", "ID_INVALID", "RECORD_NOT_FOUND"]);

export class ZohoCrmGateway implements CrmGateway {
  private apiCreditsRemaining: number | null = null;

  constructor(
    private readonly env: WorkerEnv,
    private readonly config: ZohoCrmGatewayConfig,
  ) {}

  getMetrics(): CrmGatewayMetrics {
    return { apiCreditsRemaining: this.apiCreditsRemaining };
  }

  async upsert(input: CrmUpsertInput): Promise<CrmRecordResult> {
    const rows = await this.upsertMany({
      module: input.module,
      records: [input.fields],
      duplicateCheckFields: input.duplicateCheckFields,
    });
    return (
      rows[0] ?? {
        module: input.module,
        recordId: "",
        action: "upsert",
        status: "error",
        message: "empty_upsert_response",
      }
    );
  }

  async upsertMany(input: CrmBatchUpsertInput): Promise<CrmRecordResult[]> {
    const body = {
      data: input.records,
      duplicate_check_fields: input.duplicateCheckFields,
      trigger: this.config.trigger,
    };
    const res = await this.request("POST", `/crm/v8/${input.module}/upsert`, body);
    if (res.status !== 207 && !res.ok) {
      this.throwOnHttpError(res);
    }
    const rows = parseZohoRecordResponses(res.status, res.text, res.retryAfterMs);
    return rows.map((row, index) => {
      if (row.status === "success" && row.recordId) {
        return {
          module: input.module,
          recordId: row.recordId,
          action: "upsert" as const,
          status: "success" as const,
          ...(row.code ? { code: row.code } : {}),
        };
      }
      return {
        module: input.module,
        recordId: row.recordId ?? "",
        action: "upsert" as const,
        status: "error" as const,
        ...(row.code ? { code: row.code } : {}),
        ...(row.fieldApiName ? { fieldApiName: row.fieldApiName } : {}),
        message: row.message ?? `upsert_row_${index}_failed`,
      };
    });
  }

  async updateById(input: CrmUpdateByIdInput): Promise<CrmRecordResult> {
    const body = { data: [{ ...input.fields, id: input.recordId }], trigger: this.config.trigger };
    const res = await this.request("PUT", `/crm/v8/${input.module}`, body);
    if (res.status !== 207 && !res.ok) {
      this.throwOnHttpError(res);
    }
    const rows = parseZohoRecordResponses(res.status, res.text, res.retryAfterMs);
    const first = rows[0];
    if (!first || first.status !== "success") {
      return {
        module: input.module,
        recordId: input.recordId,
        action: "update",
        status: "error",
        ...(first?.code ? { code: first.code } : {}),
        ...(first?.fieldApiName ? { fieldApiName: first.fieldApiName } : {}),
        ...(first?.message ? { message: first.message } : {}),
      };
    }
    return {
      module: input.module,
      recordId: input.recordId,
      action: "update",
      status: "success",
    };
  }

  async findByEmail(input: CrmSearchByEmailInput): Promise<CrmSearchByEmailResult> {
    const coql = `select id from ${input.module} where Email = '${escapeCoqlString(input.email)}' limit 1`;
    const res = await this.request("POST", "/crm/v8/coql", { select_query: coql });
    if (!res.ok && res.status !== 204) {
      throw new ZohoCrmHttpError(res.status, res.text.slice(0, 4_000), res.retryAfterMs);
    }
    let parsed: { data?: Array<{ id?: string }> };
    try {
      parsed = JSON.parse(res.text) as { data?: Array<{ id?: string }> };
    } catch {
      return null;
    }
    const id = parsed.data?.[0]?.id;
    if (!id) return null;
    return { recordId: id, module: input.module };
  }

  async executeCoql(selectQuery: string): Promise<string[]> {
    const res = await this.request("POST", "/crm/v8/coql", { select_query: selectQuery });
    if (!res.ok && res.status !== 204) {
      throw new ZohoCrmHttpError(res.status, res.text.slice(0, 4_000), res.retryAfterMs);
    }
    let parsed: { data?: Array<{ id?: string }> };
    try {
      parsed = JSON.parse(res.text) as { data?: Array<{ id?: string }> };
    } catch {
      return [];
    }
    return (parsed.data ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  async findDealIdsByContact(contactId: string): Promise<string[]> {
    const coql = `select id from Deals where Contact_Name = '${escapeCoqlString(contactId)}' limit 200`;
    const res = await this.request("POST", "/crm/v8/coql", { select_query: coql });
    if (!res.ok && res.status !== 204) {
      throw new ZohoCrmHttpError(res.status, res.text.slice(0, 4_000), res.retryAfterMs);
    }
    let parsed: { data?: Array<{ id?: string }> };
    try {
      parsed = JSON.parse(res.text) as { data?: Array<{ id?: string }> };
    } catch {
      return [];
    }
    return (parsed.data ?? [])
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
  }

  async convertLead(input: CrmConvertLeadInput): Promise<CrmConvertLeadResult> {
    const dataRow: Record<string, unknown> = { notify_lead_owner: false };
    if (input.contactFields && Object.keys(input.contactFields).length > 0) {
      dataRow.Contacts = input.contactFields;
    }
    const body = { data: [dataRow] };
    const res = await this.request("POST", `/crm/v8/Leads/${input.leadId}/actions/convert`, body);
    this.throwOnHttpError(res);
    const contactId = parseConvertLeadContactId(res.status, res.text);
    return { contactId };
  }

  async deleteRecord(input: CrmDeleteRecordInput): Promise<CrmDeleteRecordResult> {
    const url = `/crm/v8/${input.module}?ids=${encodeURIComponent(input.recordId)}&wf_trigger=false`;
    const res = await this.request("DELETE", url);
    if (res.status === 404) {
      return { status: "already_deleted" };
    }
    if (res.status !== 207 && !res.ok) {
      this.throwOnHttpError(res);
    }
    const rows = parseZohoRecordResponses(res.status, res.text, res.retryAfterMs);
    const first = rows[0];
    if (!first) {
      return res.ok
        ? { status: "deleted" }
        : { status: "error", code: "http_error", message: res.text.slice(0, 200) };
    }
    if (first.status === "success") return { status: "deleted" };
    if (first.code && ALREADY_DELETED_CODES.has(first.code)) {
      return { status: "already_deleted" };
    }
    return {
      status: "error",
      code: first.code ?? "DELETE_FAILED",
      ...(first.message ? { message: first.message } : {}),
    };
  }

  async purgeFromRecycleBin(recordId: string): Promise<void> {
    const res = await this.request("DELETE", `/crm/v8/settings/recycle_bin/${recordId}`);
    if (res.status === 404) return;
    if (!res.ok && res.status !== 200) {
      throw new ZohoCrmHttpError(res.status, res.text.slice(0, 4_000), res.retryAfterMs);
    }
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    retriedAuth = false,
  ): Promise<{ ok: boolean; status: number; text: string; retryAfterMs?: number }> {
    const token = await getZohoCrmAccessToken(this.env);
    if (!token) {
      throw new ZohoCrmAuthError("zoho_crm_not_configured");
    }
    const url = new URL(path, this.config.apiHost);
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const remaining = res.headers.get("X-API-CREDITS-REMAINING");
    if (remaining != null && remaining !== "") {
      const parsed = Number(remaining);
      if (!Number.isNaN(parsed)) this.apiCreditsRemaining = parsed;
    }
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs =
      retryAfterHeader != null && retryAfterHeader !== ""
        ? Number(retryAfterHeader) * 1000
        : undefined;
    const text = await res.text();
    if (res.status === 401 && !retriedAuth) {
      invalidateZohoCrmAccessToken();
      return this.request(method, path, body, true);
    }
    return {
      ok: res.ok,
      status: res.status,
      text,
      ...(retryAfterMs !== undefined && !Number.isNaN(retryAfterMs) ? { retryAfterMs } : {}),
    };
  }

  private throwOnHttpError(res: {
    ok: boolean;
    status: number;
    text: string;
    retryAfterMs?: number;
  }): void {
    if (res.ok || res.status === 204) return;
    throw new ZohoCrmHttpError(res.status, res.text.slice(0, 4_000), res.retryAfterMs);
  }
}

function escapeCoqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
