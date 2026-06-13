import type { Context } from "hono";

export type QrScanGeo = {
  country: string | null;
  region: string | null;
  city: string | null;
};

function normalizeGeoValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "XX" || trimmed === "**") return null;
  return trimmed.slice(0, 120);
}

/** Reads geo hints from common CDN / edge headers (no GeoIP lookup). */
export function readQrScanGeoFromHeaders(c: Context): QrScanGeo {
  const country =
    c.req.header("cf-ipcountry") ??
    c.req.header("x-vercel-ip-country") ??
    c.req.header("x-geo-country") ??
    c.req.header("cloudfront-viewer-country") ??
    undefined;
  const region =
    c.req.header("cf-region") ??
    c.req.header("x-vercel-ip-country-region") ??
    c.req.header("x-geo-region") ??
    undefined;
  const city =
    c.req.header("cf-ipcity") ??
    c.req.header("x-vercel-ip-city") ??
    c.req.header("x-geo-city") ??
    undefined;

  return {
    country: normalizeGeoValue(country),
    region: normalizeGeoValue(region),
    city: normalizeGeoValue(city),
  };
}
