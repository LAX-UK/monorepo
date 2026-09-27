import { classifyDeliveryError, readRetryAfterMs } from "../../lib/delivery-retry.js";
import { CrmGatewayError } from "../crm/crm-gateway-error.js";
import { classifyZohoError } from "./retry-classification.js";
import { ZohoCrmAuthError, ZohoCrmHttpError, ZohoCrmRecordError } from "./types.js";

export function mapZohoErrorToCrmGatewayError(err: unknown): CrmGatewayError {
  if (err instanceof CrmGatewayError) return err;
  if (err instanceof ZohoCrmRecordError) {
    const retryable = classifyZohoError(err) === "retryable";
    return new CrmGatewayError({
      code: err.code,
      message: err.message,
      status: err.httpStatus,
      retryable,
    });
  }
  if (err instanceof ZohoCrmHttpError) {
    const retryable = classifyZohoError(err) === "retryable";
    return new CrmGatewayError({
      code: "http_error",
      message: err.message,
      status: err.status,
      retryable,
      ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {}),
    });
  }
  if (err instanceof ZohoCrmAuthError) {
    const retryable = classifyZohoError(err) === "retryable";
    return new CrmGatewayError({
      code: "auth_error",
      message: err.message,
      status: err.status ?? 401,
      retryable,
    });
  }
  if (
    typeof err === "object" &&
    err !== null &&
    (err as { message?: string }).message === "zoho_crm_circuit_open"
  ) {
    const retryAfterMs = readRetryAfterMs(err);
    return new CrmGatewayError({
      code: "circuit_open",
      message: "zoho_crm_circuit_open",
      status: 503,
      retryable: true,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    });
  }
  const retryable =
    classifyZohoError(err) === "retryable" || classifyDeliveryError(err) === "retryable";
  const retryAfterMs = readRetryAfterMs(err);
  return new CrmGatewayError({
    code: "unknown",
    message: err instanceof Error ? err.message : "unknown_error",
    status: 500,
    retryable,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  });
}
