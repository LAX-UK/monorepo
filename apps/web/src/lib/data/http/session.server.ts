import "server-only";
import type { SessionUser } from "@/lib/data/contracts";
import { getServerHc } from "@/lib/data/http/hc-server";
import { cache } from "react";

export const getServerSessionUser = cache(
  async function getServerSessionUser(): Promise<SessionUser | null> {
    const client = await getServerHc();
    const res = await client.users.me.$get();
    if (res.status === 401) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { data: SessionUser };
    return body.data;
  },
);
