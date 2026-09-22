import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export async function proxyJson(c: Context, response: Response) {
  const body = await response.text();
  let payload: unknown = body;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    payload = { error: "invalid_upstream", message: body.slice(0, 200) };
  }
  if (
    !response.ok &&
    payload &&
    typeof payload === "object" &&
    payload !== null &&
    "code" in payload
  ) {
    const record = payload as { code?: string; message?: string };
    payload = {
      error: "commerce_upstream_failed",
      code: record.code ?? "unknown",
      message: record.message ?? "Request failed",
    };
  }
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return c.newResponse(serialized, response.status as ContentfulStatusCode, {
    "content-type": "application/json",
  });
}

export const EMPTY_BASKET = {
  basketId: null,
  lines: [],
  merchandiseSubtotalPence: 0,
  expiresAt: null,
} as const;
