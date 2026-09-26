import type { CookieJar, CookieSetOptions } from "@auction/identity-rp";
import type { NextRequest, NextResponse } from "next/server";

export function readRequestCookieJar(request: NextRequest): CookieJar {
  return {
    get: (name) => request.cookies.get(name)?.value,
    set: () => {
      throw new Error("readRequestCookieJar is read-only");
    },
    delete: () => {
      throw new Error("readRequestCookieJar is read-only");
    },
  };
}

export function writeResponseCookieJar(response: NextResponse): CookieJar {
  return {
    get: () => undefined,
    set: (name, value, options: CookieSetOptions) => {
      response.cookies.set(name, value, {
        httpOnly: options.httpOnly ?? true,
        sameSite: (options.sameSite?.toLowerCase() as "lax" | "strict" | "none") ?? "lax",
        path: options.path ?? "/",
        maxAge: options.maxAgeSeconds,
      });
    },
    delete: (name) => {
      response.cookies.delete(name);
    },
  };
}
