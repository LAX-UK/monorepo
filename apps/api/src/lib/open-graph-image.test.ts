import { describe, expect, it, vi } from "vitest";
import { extractOpenGraphImageUrl, fetchOpenGraphImage } from "./open-graph-image.js";
import { isSafePublicHttpUrl } from "./safe-public-url.js";

describe("isSafePublicHttpUrl", () => {
  it("accepts public https URLs", () => {
    expect(isSafePublicHttpUrl("https://example.com/article")).toBe(true);
  });

  it("rejects localhost", () => {
    expect(isSafePublicHttpUrl("http://localhost/article")).toBe(false);
  });

  it("rejects private IPv4 hosts", () => {
    expect(isSafePublicHttpUrl("http://192.168.0.1/internal")).toBe(false);
  });
});

describe("extractOpenGraphImageUrl", () => {
  it("reads og:image content", () => {
    const html = `<html><head><meta property="og:image" content="https://cdn.example.com/preview.jpg"></head></html>`;
    expect(extractOpenGraphImageUrl(html, new URL("https://news.example.com/a"))).toBe(
      "https://cdn.example.com/preview.jpg",
    );
  });

  it("resolves relative image paths against the page URL", () => {
    const html = `<meta property="og:image" content="/images/preview.jpg">`;
    expect(extractOpenGraphImageUrl(html, new URL("https://news.example.com/a"))).toBe(
      "https://news.example.com/images/preview.jpg",
    );
  });

  it("falls back to twitter:image", () => {
    const html = `<meta name="twitter:image" content="https://cdn.example.com/tw.jpg">`;
    expect(extractOpenGraphImageUrl(html, new URL("https://news.example.com/a"))).toBe(
      "https://cdn.example.com/tw.jpg",
    );
  });
});

describe("fetchOpenGraphImage", () => {
  it("returns null for unsafe URLs without fetching", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchOpenGraphImage("http://127.0.0.1/article", { fetchImpl }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("extracts og:image from HTML responses", async () => {
    const html = `<!doctype html><meta property="og:image" content="https://cdn.example.com/hero.jpg">`;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    await expect(
      fetchOpenGraphImage("https://news.example.com/story", { fetchImpl }),
    ).resolves.toBe("https://cdn.example.com/hero.jpg");
  });
});
