import { ZohoCrmHttpError, ZohoCrmRecordError } from "./types.js";

type ZohoRecordResponse = {
  code?: string;
  status?: string;
  message?: string;
  details?: { id?: string };
};

export function parseZohoRecordResponses(
  httpStatus: number,
  bodyText: string,
  retryAfterMs?: number,
): Array<{ status: "success" | "error"; recordId?: string; code?: string; message?: string }> {
  let parsed: { data?: ZohoRecordResponse[] };
  try {
    parsed = JSON.parse(bodyText) as { data?: ZohoRecordResponse[] };
  } catch {
    if (!httpStatusOk(httpStatus)) {
      throw new ZohoCrmHttpError(httpStatus, bodyText.slice(0, 4_000), retryAfterMs);
    }
    return [];
  }

  if (!httpStatusOk(httpStatus) && httpStatus !== 207) {
    throw new ZohoCrmHttpError(httpStatus, bodyText.slice(0, 4_000), retryAfterMs);
  }

  const rows = parsed.data ?? [];
  return rows.map((row) => ({
    status: row.status === "success" ? "success" : "error",
    ...(row.details?.id ? { recordId: row.details.id } : {}),
    ...(row.code ? { code: row.code } : {}),
    ...(row.message ? { message: row.message } : {}),
  }));
}

function httpStatusOk(status: number): boolean {
  return status >= 200 && status < 300;
}

export function firstRecordOrThrow(
  httpStatus: number,
  bodyText: string,
  context: string,
): { recordId: string; code?: string } {
  const rows = parseZohoRecordResponses(httpStatus, bodyText);
  const first = rows[0];
  if (!first || first.status !== "success" || !first.recordId) {
    throw new ZohoCrmRecordError(
      first?.code ?? "UNKNOWN",
      first?.message ?? `${context}_record_error`,
      httpStatus,
    );
  }
  return { recordId: first.recordId, ...(first.code ? { code: first.code } : {}) };
}
