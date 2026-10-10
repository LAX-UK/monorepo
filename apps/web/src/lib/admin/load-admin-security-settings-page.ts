import "server-only";

import {
  type TwoFactorPolicyView,
  getServerStaffTwoFactorPolicy,
} from "@/lib/data/http/two-factor-policy.server";

export type AdminSecuritySettingsPageData = { staffTwoFactor: TwoFactorPolicyView | null };

export async function loadAdminSecuritySettingsPage(): Promise<AdminSecuritySettingsPageData> {
  return { staffTwoFactor: await getServerStaffTwoFactorPolicy() };
}
