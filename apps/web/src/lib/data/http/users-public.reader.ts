import "server-only";

import type { PublicUser, PublicUserReader } from "@/lib/data/contracts";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { publicUserSchema } from "@/lib/data/http/users-public.schema";

export async function getServerPublicUserReader(): Promise<PublicUserReader> {
  return {
    async getById(userId: string): Promise<PublicUser | null> {
      const res = await fetch(`${getServerApiBase()}/users/public/${encodeURIComponent(userId)}`, {
        next: { revalidate: 120 },
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Failed to load user: ${res.status}`);
      }
      const body = await readJsonBody(res);
      return readDataEnvelope(body, publicUserSchema, `GET /users/public/${userId}`);
    },
  };
}
