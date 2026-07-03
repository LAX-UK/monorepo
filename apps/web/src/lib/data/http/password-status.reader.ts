import "server-only";

import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { cookies } from "next/headers";
import { z } from "zod";

async function authedInit(init: RequestInit = {}): Promise<RequestInit> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (cookieHeader) {
    return { ...init, headers: { ...(init.headers ?? {}), Cookie: cookieHeader } };
  }
  return init;
}

const passwordStatusSchema = z.object({ hasPassword: z.boolean() });

/** Session-only: whether the signed-in user has a credential (password) account row. */
export async function getServerHasPassword(): Promise<boolean> {
  const base = getServerApiBase();
  const res = await fetch(`${base}/auth/password-status`, await authedInit({ cache: "no-store" }));
  if (!res.ok) return false;
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(body, passwordStatusSchema, "GET /auth/password-status");
  return Boolean(parsed.hasPassword);
}
