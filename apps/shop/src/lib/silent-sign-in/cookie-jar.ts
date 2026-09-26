import type { CookieJar } from "@auction/identity-rp";
import type { NextRequest } from "next/server";

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
