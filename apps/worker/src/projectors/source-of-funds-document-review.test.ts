import type pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { processSourceOfFundsDocumentReview } from "./source-of-funds-document-review.js";

function fakeDb(results: unknown[]) {
  const make = () => {
    const proxy: unknown = new Proxy(() => {}, {
      get(_t, prop) {
        if (prop === "then") {
          const value = results.shift();
          return (resolve: (v: unknown) => void) => resolve(value);
        }
        return () => proxy;
      },
    });
    return proxy;
  };
  return new Proxy(
    {},
    {
      get() {
        return () => make();
      },
    },
  ) as never;
}

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as pino.Logger;

describe("processSourceOfFundsDocumentReview", () => {
  it("returns without error when there are no new events", async () => {
    const db = fakeDb([undefined, [{ last: 0 }], []]);
    await processSourceOfFundsDocumentReview({ db, log });
    expect(log.error).not.toHaveBeenCalled();
  });
});
