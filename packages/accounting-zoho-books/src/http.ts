import { ZohoBooksError, ZohoNetworkError, ZohoUnknownError } from "./errors.js";
import type { Clock, TransportRequest, TransportResponse, ZohoTransport } from "./ports.js";

/**
 * Sends one request with a hard timeout, enforced here (not left to the transport) so a transport
 * that hangs still ends. Failures become typed errors; the cause's message is never kept, only its
 * name, because a network error's text can contain the URL.
 */
export async function sendWithTimeout(
  deps: { readonly transport: ZohoTransport; readonly clock: Clock },
  request: TransportRequest,
  timeoutMs: number,
  maxResponseBytes: number,
): Promise<TransportResponse> {
  const controller = new AbortController();
  const stopTimer = new AbortController();
  const timeout = deps.clock
    .sleep(timeoutMs, stopTimer.signal)
    .then(() => ({ timedOut: true as const }));
  try {
    const result = await Promise.race([deps.transport.send(request, controller.signal), timeout]);
    if ("timedOut" in result) {
      controller.abort();
      throw new ZohoNetworkError({ code: "timeout" });
    }
    if (result.body.length > maxResponseBytes) {
      throw new ZohoUnknownError({ code: "response_too_large", httpStatus: result.status });
    }
    return result;
  } catch (error) {
    if (error instanceof ZohoBooksError) throw error;
    throw new ZohoNetworkError({ code: causeCode(error) });
  } finally {
    stopTimer.abort();
  }
}

function causeCode(error: unknown): string {
  if (error instanceof Error && error.message === "response_too_large") return "response_too_large";
  return "connection_failed";
}

/** Seconds or an HTTP date, as milliseconds from now; undefined when absent or unreadable. */
export function parseRetryAfter(value: string | undefined, nowMs: number): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? undefined : Math.max(0, at - nowMs);
}

export function parseJson(body: string): { ok: true; value: unknown } | { ok: false } {
  if (body.trim() === "") return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(body) as unknown };
  } catch {
    return { ok: false };
  }
}
