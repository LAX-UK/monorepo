import type { NextResponse } from "next/server";

/** Opt in to `Sec-CH-Prefers-Color-Scheme` so SSR can match the inline theme bootstrap. */
export function applyClientHintHeaders(response: NextResponse): void {
  response.headers.set("Accept-CH", "Sec-CH-Prefers-Color-Scheme");
  response.headers.set("Critical-CH", "Sec-CH-Prefers-Color-Scheme");
  response.headers.set("Vary", "Sec-CH-Prefers-Color-Scheme");
}
