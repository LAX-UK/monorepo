import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { applyClientHintHeaders } from "./client-hint-headers";

describe("applyClientHintHeaders", () => {
  it("asks for prefers-color-scheme without forcing a restart of the first navigation", () => {
    const response = NextResponse.next();
    applyClientHintHeaders(response);

    expect(response.headers.get("Accept-CH")).toBe("Sec-CH-Prefers-Color-Scheme");
    expect(response.headers.get("Critical-CH")).toBeNull();
    expect(response.headers.get("Vary")).toBe("Sec-CH-Prefers-Color-Scheme");
  });
});
