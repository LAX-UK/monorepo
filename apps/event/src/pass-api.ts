import {
  type ApiErrorBody,
  normalizeApiErrorMessage,
  parseApiErrorCodeFromBody,
} from "./api-error-body.js";
import type { OnsiteEventPassView } from "./pass-types.js";
import { API_BASE, EVENT_SLUG } from "./config.js";

const PASS_FETCH_TIMEOUT_MS = 15_000;

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new PassFetchError("Pass response was invalid", `pass_invalid_json_${res.status}`);
  }
}

export class PassFetchError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "PassFetchError";
  }
}

export async function fetchPass(token: string): Promise<OnsiteEventPassView> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/events/${EVENT_SLUG}/pass/${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(PASS_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new PassFetchError("This is taking longer than expected", "timeout");
    }
    throw new PassFetchError("Could not reach the server", "offline");
  }
  const body = await parseJson<{ data?: OnsiteEventPassView } & ApiErrorBody>(res);
  if (!res.ok) {
    const code = parseApiErrorCodeFromBody(body) ?? `pass_failed_${res.status}`;
    throw new PassFetchError(normalizeApiErrorMessage(body.error, "Pass not found"), code);
  }
  if (!body.data) {
    throw new Error("pass_empty_response");
  }
  return body.data;
}

export function parsePassTokenFromPath(): string | null {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments[0] !== "pass" || !segments[1]) return null;
  return decodeURIComponent(segments[1]);
}
