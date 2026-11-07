import type { NextResponse } from "next/server";

/**
 * Opt in to `Sec-CH-Prefers-Color-Scheme` so SSR can match the inline theme bootstrap from the
 * browser's second request on. Not `Critical-CH`: on a browser's first visit that makes Chrome
 * restart the navigation, and when it was the sign-in callback the one-time code is sent twice and
 * the second use fails.
 */
export function applyClientHintHeaders(response: NextResponse): void {
  response.headers.set("Accept-CH", "Sec-CH-Prefers-Color-Scheme");
  response.headers.set("Vary", "Sec-CH-Prefers-Color-Scheme");
}
