"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export function readApiError(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return fallback;
}

export type JsonFetchOpts = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  okRedirect: string;
  errRedirect: string;
  revalidatePaths?: string[];
};

export async function authedJsonRedirect(opts: JsonFetchOpts): Promise<void> {
  const init: RequestInit = { method: opts.method ?? "POST" };
  if (opts.json !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.json);
  }
  const res = await authedServerFetch(opts.path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    redirect(
      `${opts.errRedirect}?error=${encodeURIComponent(readApiError(body, "Request failed"))}`,
    );
  }
  for (const p of opts.revalidatePaths ?? []) {
    revalidatePath(p);
  }
  redirect(opts.okRedirect);
}
