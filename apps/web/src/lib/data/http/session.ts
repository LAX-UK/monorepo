import type { SessionReader, SessionUser } from "@/lib/data/contracts";
import { getBrowserHc } from "@/lib/data/http/hc-browser";

export function createHttpSessionReader(): SessionReader {
  const client = getBrowserHc();
  return {
    async getSession(): Promise<SessionUser | null> {
      const res = await client.users.me.$get();
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { data: SessionUser };
      return body.data;
    },
  };
}
