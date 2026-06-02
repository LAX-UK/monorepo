import { heroCoverObjectPosition, resolveHeroCoverSources } from "@/lib/media/hero-cover-sources";
import { describe, expect, it } from "vitest";

describe("resolveHeroCoverSources", () => {
  it("resolves desktop URL and omits mobile when absent", () => {
    const result = resolveHeroCoverSources({
      desktopUrl: "https://cdn.example.com/hero.jpg",
    });
    expect(result.desktopUrl).toBe("https://cdn.example.com/hero.jpg");
    expect(result.mobileUrl).toBeNull();
  });

  it("includes mobile URL when distinct from desktop", () => {
    const result = resolveHeroCoverSources({
      desktopUrl: "https://cdn.example.com/hero-wide.jpg",
      mobileUrl: "https://cdn.example.com/hero-mobile.jpg",
    });
    expect(result.mobileUrl).toBe("https://cdn.example.com/hero-mobile.jpg");
  });

  it("drops mobile URL when identical to desktop", () => {
    const url = "https://cdn.example.com/same.jpg";
    const result = resolveHeroCoverSources({
      desktopUrl: url,
      mobileUrl: url,
    });
    expect(result.mobileUrl).toBeNull();
  });

  it("includes desktop wide URL when distinct from desktop master", () => {
    const result = resolveHeroCoverSources({
      desktopUrl: "https://cdn.example.com/hero-wide.jpg",
      desktopWideUrl: "https://cdn.example.com/hero-xl.jpg",
    });
    expect(result.desktopWideUrl).toBe("https://cdn.example.com/hero-xl.jpg");
  });

  it("drops desktop wide URL when identical to desktop master", () => {
    const url = "https://cdn.example.com/same.jpg";
    const result = resolveHeroCoverSources({
      desktopUrl: url,
      desktopWideUrl: url,
    });
    expect(result.desktopWideUrl).toBeNull();
  });

  it("maps coverImages[1] pattern via mobileUrl input", () => {
    const result = resolveHeroCoverSources({
      desktopUrl: "https://cdn.example.com/a.jpg",
      mobileUrl: "https://cdn.example.com/b.jpg",
      objectPosition: "center 30%",
    });
    expect(result.objectPosition).toBe("center 30%");
  });
});

describe("heroCoverObjectPosition", () => {
  it("uses override for both breakpoints when set", () => {
    const pos = heroCoverObjectPosition({
      desktopUrl: "https://cdn.example.com/x.jpg",
      objectPosition: "center 20%",
    });
    expect(pos.mobile).toBe("center 20%");
    expect(pos.desktop).toBe("center 20%");
  });

  it("uses defaults when override absent", () => {
    const pos = heroCoverObjectPosition({ desktopUrl: null });
    expect(pos.mobile).toBe("center 35%");
    expect(pos.desktop).toBe("center center");
  });
});
