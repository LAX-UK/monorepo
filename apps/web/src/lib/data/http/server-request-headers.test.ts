import { describe, expect, it } from "vitest";
import { deriveSsrOriginFromHeaders } from "./ssr-origin";

describe("deriveSsrOriginFromHeaders", () => {
  it("uses Origin header when present", () => {
    expect(
      deriveSsrOriginFromHeaders({
        get: (n) => (n === "origin" ? "https://lax.bid" : null),
      }),
    ).toBe("https://lax.bid");
  });

  it("builds origin from x-forwarded-proto and x-forwarded-host", () => {
    expect(
      deriveSsrOriginFromHeaders({
        get: (n) => {
          if (n === "x-forwarded-proto") return "https";
          if (n === "x-forwarded-host") return "lax.bid";
          return null;
        },
      }),
    ).toBe("https://lax.bid");
  });

  it("falls back to NEXT_PUBLIC_WEB_ORIGIN env", () => {
    expect(deriveSsrOriginFromHeaders({ get: () => null }, "https://staging.lax.bid/")).toBe(
      "https://staging.lax.bid",
    );
  });

  it("uses host with http for localhost", () => {
    expect(
      deriveSsrOriginFromHeaders({
        get: (n) => (n === "host" ? "localhost:3000" : null),
      }),
    ).toBe("http://localhost:3000");
  });
});
