import "server-only";

import { isTokenReplaceableCode } from "@auction/identity-contracts";

const MAX_ENVELOPE_BYTES = 4096;

/** Drops an unused response body so its connection is freed; never waits on it. */
function discard(response: Response): void {
  void response.body?.cancel().catch(() => undefined);
}

/** The body as text, or `null` when it is absent or longer than `maxBytes` (counted in bytes). */
async function readBoundedText(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      // Not awaited: this reads a clone, and a cancel settles only once the original is cancelled.
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * True only for the API's 401 that names a token a fresh one replaces: its signing key was
 * rotated out, or it expired. Every other 401 (revoked session, bad audience, missing scope) is a
 * different failure that a new token would not fix. The body is read from a clone, so the
 * caller's response stays unread.
 */
export async function isReplaceableTokenRejection(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  if (!response.headers.get("content-type")?.includes("json")) return false;
  try {
    const text = await readBoundedText(response.clone(), MAX_ENVELOPE_BYTES);
    if (text === null) return false;
    return isTokenReplaceableCode((JSON.parse(text) as { code?: unknown } | null)?.code);
  } catch {
    return false;
  }
}

/**
 * The one retry policy for resource tokens: send with the cached token; if the API says the token
 * is replaceable (see {@link isReplaceableTokenRejection}), `refresh` for a new one and send once
 * more. Never loops: the second response is returned whatever it is. `refresh` returns `null` when
 * no replacement is available, and the first response is returned untouched.
 *
 * Replaying is safe for any method because that 401 comes from the API's auth middleware, which
 * runs before every handler, so the rejected request had no effect. The caller keeps the request
 * body replayable (buffered bytes, not a stream).
 */
export async function sendWithKeyRetry<R extends { token: string }>(options: {
  /** The cached or exchanged token, or `null` for a request that carries none. */
  resource: R | null;
  /** Gets the token that replaces `rejected`, or `null` when none is available. */
  refresh: (rejected: R) => Promise<R | null>;
  send: (resource: R | null) => Promise<Response>;
}): Promise<{ response: Response; resource: R | null }> {
  const first = await options.send(options.resource);
  if (!options.resource || !(await isReplaceableTokenRejection(first))) {
    return { response: first, resource: options.resource };
  }
  let fresh: R | null;
  try {
    fresh = await options.refresh(options.resource);
  } catch (error) {
    discard(first);
    throw error;
  }
  if (!fresh) return { response: first, resource: options.resource };
  discard(first);
  return { response: await options.send(fresh), resource: fresh };
}
