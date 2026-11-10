import "server-only";

import { sendWithKeyRetry } from "@/lib/bff/token-key-retry.server";

/** Whether a request body can be sent a second time (a stream is consumed by the first send). */
export function isReplayableBody(body: BodyInit | null | undefined): boolean {
  return !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream);
}

function bearerOf(headers: Headers): string | null {
  const value = headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length) : null;
}

type Attempt = { token: string; headers: Headers };

/**
 * Sends a server-side API request whose headers carry the session's cached Bearer token, with the
 * one retry policy ({@link sendWithKeyRetry}): when the API says that token is replaceable, the
 * headers are built again with the rejected token excluded and the request goes out once more.
 * Without a Bearer, with a body that cannot be replayed, or when no new token can be had, the
 * first response is returned as is.
 */
export async function sendWithSsrKeyRetry(options: {
  /** Builds the request headers; `rejected` is the Bearer the API refused, to be replaced. */
  buildHeaders: (rejected?: string) => Promise<Headers>;
  send: (headers: Headers) => Promise<Response>;
  replayable?: boolean;
}): Promise<Response> {
  const headers = await options.buildHeaders();
  const token = bearerOf(headers);
  const { response } = await sendWithKeyRetry<Attempt>({
    resource: token && options.replayable !== false ? { token, headers } : null,
    refresh: async (rejected) => {
      const retryHeaders = await options.buildHeaders(rejected.token);
      const fresh = bearerOf(retryHeaders);
      return fresh && fresh !== rejected.token ? { token: fresh, headers: retryHeaders } : null;
    },
    send: (attempt) => options.send(attempt?.headers ?? headers),
  });
  return response;
}
