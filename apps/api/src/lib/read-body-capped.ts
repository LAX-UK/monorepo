/**
 * Reads a request body as UTF-8 text, stopping as soon as more than `maxBytes` have arrived.
 * Returns null when the body is larger, after cancelling the rest of the stream, so an oversized
 * body is never held in memory whatever its Content-Length said (or did not say).
 */
export async function readBodyCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total).toString("utf8");
}
