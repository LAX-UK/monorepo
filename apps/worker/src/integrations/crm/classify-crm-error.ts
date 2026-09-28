import {
  classifyDeliveryError,
  isRetryableDeliveryError,
  readRetryAfterMs,
} from "../../lib/delivery-retry.js";
import { CrmGatewayError } from "./crm-gateway-error.js";

export function toCrmGatewayError(err: unknown): CrmGatewayError {
  if (err instanceof CrmGatewayError) return err;
  const retryable = isRetryableDeliveryError(err) || classifyDeliveryError(err) === "retryable";
  const retryAfterMs = readRetryAfterMs(err);
  return new CrmGatewayError({
    code: "unknown",
    message: err instanceof Error ? err.message : "unknown_error",
    status: 500,
    retryable,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  });
}

export function crmErrorOutcome(err: unknown): { retryable: boolean; error: CrmGatewayError } {
  const error = toCrmGatewayError(err);
  return { retryable: error.retryable, error };
}
