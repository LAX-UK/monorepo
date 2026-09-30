import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isBackgroundNextAuthRequest } from "./is-background-next-request.js";

describe("isBackgroundNextAuthRequest", () => {
  it("detects Next.js prefetch headers", () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      headers: { "next-router-prefetch": "1" },
    });
    expect(isBackgroundNextAuthRequest(request)).toBe(true);
  });

  it("allows document navigation", () => {
    const request = new NextRequest("http://localhost:3000/api/auth/login", {
      headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
    });
    expect(isBackgroundNextAuthRequest(request)).toBe(false);
  });
});
