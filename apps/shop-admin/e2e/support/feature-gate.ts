import { type APIRequestContext, test } from "@playwright/test";
import type { StaffBrowserSession } from "./staff-session.js";

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

export async function requireFeatureOrSkip(
  request: APIRequestContext,
  session: StaffBrowserSession,
  feature: keyof AdminSessionFeatures,
): Promise<void> {
  const features = await readAdminSessionFeatures(request, session.baseUrl, session.cookieHeader);
  test.skip(!features[feature], featureDisabledReason(feature));
}
