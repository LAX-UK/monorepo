import type { OnsiteEventPassView } from "@auction/types";
import { API_BASE, EVENT_SLUG } from "./config.js";

type ApiError = { error: string; code?: string };

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
    res = await fetch(`${API_BASE}/events/${EVENT_SLUG}/pass/${encodeURIComponent(token)}`);
  } catch {
    throw new PassFetchError("Could not reach the server", "offline");
  }
  const body = await parseJson<{ data?: OnsiteEventPassView } & ApiError>(res);
  if (!res.ok) {
    throw new PassFetchError(
      body.error ?? "Pass not found",
      body.code ?? `pass_failed_${res.status}`,
    );
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
