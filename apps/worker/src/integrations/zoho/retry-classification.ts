import { ZohoCrmAuthError, ZohoCrmHttpError } from "./types.js";

export type ZohoRetryClass = "retryable" | "fatal";

export function classifyZohoError(err: unknown): ZohoRetryClass {
  if (err instanceof ZohoCrmAuthError) return "fatal";
  if (err instanceof ZohoCrmHttpError) {
    if (err.status === 429 || err.status >= 500) return "retryable";
    if (err.status === 401 || err.status === 403) return "fatal";
    return "fatal";
  }
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  if (message.includes("timeout") || message.includes("econnreset")) return "retryable";
  return "fatal";
}
