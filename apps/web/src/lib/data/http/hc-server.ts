import "server-only";
import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";
import { cookies } from "next/headers";

const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

export async function getServerHc(): Promise<RpcApp> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  return hcAsRpcApp(base, {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      if (cookieHeader) headers.set("Cookie", cookieHeader);
      return fetch(input, {
        ...init,
        headers,
        credentials: "include",
      });
    },
  });
}
