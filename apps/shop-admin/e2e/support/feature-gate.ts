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

const STAFF_FEATURE_ENV: Record<keyof AdminSessionFeatures, string> = {
  payouts: "SHOP_ACCEPTANCE_FEATURE_PAYOUTS",
  thirdPartySales: "SHOP_ACCEPTANCE_FEATURE_THIRD_PARTY",
  originalSales: "SHOP_ACCEPTANCE_FEATURE_ORIGINALS",
  merchandise: "SHOP_ACCEPTANCE_FEATURE_MERCHANDISE",
};

/** Staging acceptance: skip before OIDC sign-in when the GitHub test var is not enabled. */
export function skipStaffFeatureUnlessEnabled(feature: keyof AdminSessionFeatures): void {
  const envKey = STAFF_FEATURE_ENV[feature];
  const enabled = (process.env[envKey] ?? "false").trim() === "true";
  test.skip(!enabled, featureDisabledReason(feature));
}

export async function requireFeatureOrSkip(
  request: APIRequestContext,
  session: StaffBrowserSession,
  feature: keyof AdminSessionFeatures,
): Promise<void> {
  const features = await readAdminSessionFeatures(request, session.baseUrl, session.cookieHeader);
  test.skip(!features[feature], featureDisabledReason(feature));
}
