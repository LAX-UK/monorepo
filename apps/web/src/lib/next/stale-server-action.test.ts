import { isStaleServerActionError } from "@/lib/next/stale-server-action";
import { describe, expect, it } from "vitest";

function unrecognizedActionError(): Error {
  const error = new Error(
    'Server Action "7f3a" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action',
  );
  error.name = "UnrecognizedActionError";
  return error;
}

describe("isStaleServerActionError", () => {
  it("recognises Next's UnrecognizedActionError after a deploy", () => {
    expect(isStaleServerActionError(unrecognizedActionError())).toBe(true);
  });

  it("recognises the message when the error class name was lost", () => {
    const error = new Error('Server Action "abc" was not found on the server.');
    expect(isStaleServerActionError(error)).toBe(true);
  });

  it("looks through a wrapper that keeps the original as its cause", () => {
    const wrapped = new Error("Clerk action failed", { cause: unrecognizedActionError() });
    expect(isStaleServerActionError(wrapped)).toBe(true);
  });

  it("ignores ordinary failures", () => {
    expect(isStaleServerActionError(new Error("Hammer failed"))).toBe(false);
    expect(isStaleServerActionError(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleServerActionError(null)).toBe(false);
    expect(isStaleServerActionError("Server Action x was not found on the server")).toBe(false);
  });
});
