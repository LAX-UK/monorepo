import { apiBaseUrl } from "@/lib/auth/api-base";

/** Fire-and-forget security awareness email (enqueued server-side). */
export function notifyTwoFactorEnabledEmail(): void {
  void fetch(`${apiBaseUrl()}/users/me/security-notify/two-factor-enabled`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export function notifyTwoFactorDisabledEmail(): void {
  void fetch(`${apiBaseUrl()}/users/me/security-notify/two-factor-disabled`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}
