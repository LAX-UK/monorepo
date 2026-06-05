import {
  type ApiErrorBody,
  normalizeApiErrorMessage,
  parseApiErrorCodeFromBody,
} from "@auction/validators";

export async function readStripeConnectApiJson<T extends Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text().catch(() => "");
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

/** Reads stable API error codes from Connect route failures (server actions). */
export function parseStripeConnectActionErrorFromBody(
  body: ApiErrorBody | Record<string, unknown>,
  fallback: string,
): string {
  const errorBody = body as ApiErrorBody;
  const code = parseApiErrorCodeFromBody(errorBody);
  if (code) return code;

  if (errorBody.error !== undefined) {
    const normalized = normalizeApiErrorMessage(errorBody.error, fallback);
    if (normalized !== fallback) return normalized;
  }

  return fallback;
}

export async function parseStripeConnectActionError(
  res: Response,
  fallback: string,
): Promise<string> {
  const body = await readStripeConnectApiJson(res);
  return parseStripeConnectActionErrorFromBody(body, fallback);
}
