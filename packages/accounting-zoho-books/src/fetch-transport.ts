import type { TransportRequest, TransportResponse, ZohoTransport } from "./ports.js";

/**
 * The real transport, over `fetch`. It never follows a redirect (the token must not travel to a
 * host we did not choose) and refuses a body larger than `maxResponseBytes`. Never used in tests.
 */
export function createFetchTransport(options: {
  readonly maxResponseBytes: number;
  readonly fetchImpl?: typeof fetch;
}): ZohoTransport {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  return {
    async send(request: TransportRequest, signal: AbortSignal): Promise<TransportResponse> {
      const init: RequestInit = {
        method: request.method,
        headers: { ...request.headers },
        redirect: "manual",
        signal,
      };
      if (request.body !== undefined) init.body = request.body;
      const response = await doFetch(request.url, init);
      const declared = Number(response.headers.get("content-length") ?? "0");
      if (declared > options.maxResponseBytes) {
        await response.body?.cancel();
        throw new Error("response_too_large");
      }
      const body = await readCapped(response, options.maxResponseBytes);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      return { status: response.status, headers, body };
    },
  };
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
