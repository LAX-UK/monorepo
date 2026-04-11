import "server-only";
import type { PublicUser, PublicUserReader } from "@/lib/data/contracts";
import { getServerApiBase } from "@/lib/data/http/hc-server";

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
      const body = (await res.json()) as { data: PublicUser };
      return body.data;
    },
  };
}
