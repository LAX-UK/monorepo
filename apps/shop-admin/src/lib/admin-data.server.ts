import { cookies } from "next/headers";
import { SHOP_ADMIN_SESSION_COOKIE } from "./session-cookie";

async function adminFetch(path: string): Promise<Response | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value;
  if (!session) return null;
  const base = process.env.SHOP_ADMIN_INTERNAL_URL ?? "http://127.0.0.1:3030";
  return fetch(`${base}/api/admin/${path}`, {
    cache: "no-store",
    headers: { cookie: `${SHOP_ADMIN_SESSION_COOKIE}=${session}` },
  });
}

export async function loadAdminSession() {
  const response = await adminFetch("session");
  if (!response?.ok) return null;
  return response.json() as Promise<{
    subject: string;
    role: string;
    capabilities: string[];
    features: {
      payouts: boolean;
      thirdPartySales: boolean;
      originalSales: boolean;
      merchandise: boolean;
    };
  }>;
}

export async function loadAdminList<T>(path: string): Promise<T | null> {
  const response = await adminFetch(path);
  if (!response?.ok) return null;
  return response.json() as Promise<T>;
}
