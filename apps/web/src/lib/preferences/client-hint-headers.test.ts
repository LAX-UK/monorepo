import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { applyClientHintHeaders } from "./client-hint-headers";

describe("applyClientHintHeaders", () => {
  it("sets Client Hint headers for prefers-color-scheme", () => {
    const response = NextResponse.next();
    applyClientHintHeaders(response);

    expect(response.headers.get("Accept-CH")).toBe("Sec-CH-Prefers-Color-Scheme");
    expect(response.headers.get("Critical-CH")).toBe("Sec-CH-Prefers-Color-Scheme");
    expect(response.headers.get("Vary")).toBe("Sec-CH-Prefers-Color-Scheme");
  });
});
