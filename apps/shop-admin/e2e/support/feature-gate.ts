import type { APIRequestContext } from "@playwright/test";

export type AdminSessionFeatures = {
  payouts: boolean;
  thirdPartySales: boolean;
  originalSales: boolean;
  merchandise: boolean;
};

export async function readAdminSessionFeatures(
  request: APIRequestContext,
  baseUrl: string,
  cookieHeader: string,
): Promise<AdminSessionFeatures> {
  const res = await request.get(`${baseUrl}/api/admin/session`, {
    headers: { cookie: cookieHeader },
  });
  if (!res.ok()) {
    throw new Error(`admin session probe failed (${res.status()})`);
  }
  const json = (await res.json()) as { features: AdminSessionFeatures };
  return json.features;
}

export function featureDisabledReason(feature: keyof AdminSessionFeatures): string {
  return `${feature} disabled on target environment`;
}
