import { getServerApiBase } from "@/lib/data/http/hc-server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/data/http/hc-server", () => ({
  getServerApiBase: vi.fn(() => "http://127.0.0.1:3001"),
}));

describe("GET /q/[shortCode]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(getServerApiBase).mockReturnValue("http://127.0.0.1:3001");
  });

  it("forwards a 302 redirect from the API with X-Robots-Tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://lax.bid/lot/test",
            "x-robots-tag": "noindex",
          },
        }),
      ),
    );

    const res = await GET(new Request("http://localhost:3000/q/Abc12345"), {
      params: Promise.resolve({ shortCode: "Abc12345" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://lax.bid/lot/test");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/q/Abc12345",
      expect.objectContaining({ method: "GET", redirect: "manual" }),
    );
  });

  it("forwards scan-relevant request headers to the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("This QR code is no longer active.", { status: 410 })),
    );

    await GET(
      new Request("http://localhost:3000/q/Abc12345", {
        headers: {
          "user-agent": "Mozilla/5.0",
          referer: "https://example.test",
          "x-forwarded-for": "203.0.113.42",
        },
      }),
      { params: Promise.resolve({ shortCode: "Abc12345" }) },
    );

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("user-agent")).toBe("Mozilla/5.0");
    expect(headers.get("referer")).toBe("https://example.test");
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.42");
  });

  it("returns 410 body from the API for inactive codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("This QR code is no longer active.", {
          status: 410,
          headers: { "x-robots-tag": "noindex" },
        }),
      ),
    );

    const res = await GET(new Request("http://localhost:3000/q/Abc12345"), {
      params: Promise.resolve({ shortCode: "Abc12345" }),
    });

    expect(res.status).toBe(410);
    expect(await res.text()).toBe("This QR code is no longer active.");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("forwards the upstream status for non-redirect client errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("QR code not found.", { status: 404 })),
    );

    const res = await GET(new Request("http://localhost:3000/q/Abc12345"), {
      params: Promise.resolve({ shortCode: "Abc12345" }),
    });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("QR code not found.");
  });

  it("returns 502 when the upstream API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const res = await GET(new Request("http://localhost:3000/q/Abc12345"), {
      params: Promise.resolve({ shortCode: "Abc12345" }),
    });

    expect(res.status).toBe(502);
  });
});
