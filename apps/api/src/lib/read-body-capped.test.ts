import { describe, expect, it, vi } from "vitest";
import { readBodyCapped } from "./read-body-capped.js";

function streamed(parts: string[]): { request: Request; pulled: () => number } {
  let index = 0;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const part = parts[index];
      index += 1;
      if (part === undefined) controller.close();
      else controller.enqueue(encoder.encode(part));
    },
  });
  const request = new Request("http://test/", { method: "POST", body, duplex: "half" } as never);
  return { request, pulled: () => index };
}

describe("readBodyCapped", () => {
  it("returns the whole body at or under the cap, across chunks and multibyte characters", async () => {
    const { request } = streamed(['{"a":', '"é"}']);
    // "é" is two bytes in UTF-8: the body is ten bytes.
    expect(await readBodyCapped(request, 10)).toBe('{"a":"é"}');
  });

  it("stops reading as soon as the cap is passed, without a Content-Length", async () => {
    const { request, pulled } = streamed(["aaaa", "bbbb", "cccc", "dddd", "eeee"]);
    expect(await readBodyCapped(request, 6)).toBeNull();
    // Two chunks were enough to know; the rest of the stream was never pulled.
    expect(pulled()).toBeLessThanOrEqual(3);
  });

  it("reads an empty body as an empty string", async () => {
    expect(await readBodyCapped(new Request("http://test/", { method: "POST" }), 10)).toBe("");
  });

  it("cancels the stream it gives up on", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20));
      },
      cancel,
    });
    const request = new Request("http://test/", { method: "POST", body, duplex: "half" } as never);
    expect(await readBodyCapped(request, 10)).toBeNull();
    expect(cancel).toHaveBeenCalled();
  });
});
