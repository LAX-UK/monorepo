import { describe, expect, it } from "vitest";
import { decideFailure } from "./failure-policy.js";
import { permanentError, transientError } from "./subject-export.errors.js";

const HOUR = 3_600_000;
const base = { attempt: 1, maxAttempts: 13, elapsedMs: HOUR };

describe("decideFailure", () => {
  it("fails a permanent error at once", () => {
    expect(decideFailure({ ...base, error: permanentError("bad", "bid") })).toEqual({
      action: "fail",
    });
  });

  it("retries a transient error while the window and attempts last", () => {
    expect(decideFailure({ ...base, error: transientError("down", "bid") })).toEqual({
      action: "retry",
    });
    expect(
      decideFailure({ ...base, elapsedMs: 71 * HOUR, error: transientError("down", "bid") }),
    ).toEqual({
      action: "retry",
    });
  });

  it("delays the request once 72 hours or the attempts are used, naming the product", () => {
    expect(
      decideFailure({ ...base, elapsedMs: 72 * HOUR, error: transientError("down", "shop") }),
    ).toEqual({
      action: "delay",
      product: "shop",
    });
    expect(
      decideFailure({ ...base, attempt: 13, error: transientError("down", "account") }),
    ).toEqual({
      action: "delay",
      product: "account",
    });
  });

  it("fails, rather than delays, when no product is to blame", () => {
    expect(
      decideFailure({ ...base, attempt: 13, error: transientError("storage_upload_failed") }),
    ).toEqual({
      action: "fail",
    });
  });
});
