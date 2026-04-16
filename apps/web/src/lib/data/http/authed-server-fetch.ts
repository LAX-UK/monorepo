import "server-only";

import { cookies } from "next/headers";
import { getServerApiBase } from "./hc-server";

/** Cookie-authenticated `fetch` for Server Components and Server Actions. */
export async function authedServerFetch(path: string, init?: RequestInit): Promise<Response> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const headers = new Headers(init?.headers);
  if (cookie) headers.set("Cookie", cookie);
  return fetch(`${getServerApiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}
