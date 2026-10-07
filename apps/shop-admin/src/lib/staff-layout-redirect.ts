import type { AdminFetchResult, AdminSessionPayload } from "@/lib/admin-data.server";
import { safeReturnTo } from "@/lib/safe-return-to";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";

export type StaffLayoutRedirect =
  | { action: "render" }
  | { action: "reauth"; returnTo: string; reason?: "not_authorized" }
  | { action: "login_error"; error: "not_authorized" }
  | { action: "fail"; detail: string };

export function resolveStaffLayoutRedirect(
  sessionResult: AdminFetchResult<AdminSessionPayload>,
  pathname: string | null | undefined,
): StaffLayoutRedirect {
  const returnTo = safeReturnTo(pathname);

  if (sessionResult.status === "ok") {
    return { action: "render" };
  }

  if (sessionResult.status === "unauthorized") {
    return { action: "reauth", returnTo };
  }

  if (sessionResult.status === "forbidden") {
    const code = sessionResult.code;
    if (code === SHOP_API_ERROR_CODES.STAFF_REQUIRED) {
      return { action: "reauth", returnTo, reason: "not_authorized" };
    }
    if (code === SHOP_API_ERROR_CODES.STEP_UP_REQUIRED) {
      return { action: "reauth", returnTo };
    }
    if (code === SHOP_API_ERROR_CODES.FORBIDDEN) {
      return { action: "reauth", returnTo, reason: "not_authorized" };
    }
    return {
      action: "fail",
      detail: code ? `forbidden:${code}` : "forbidden",
    };
  }

  return { action: "fail", detail: sessionResult.status };
}

export function staffReauthHref(
  redirect: Extract<StaffLayoutRedirect, { action: "reauth" }>,
): string {
  const params = new URLSearchParams({ returnTo: redirect.returnTo });
  if (redirect.reason === "not_authorized") {
    params.set("reason", "not_authorized");
  }
  return `/api/auth/reauth?${params.toString()}`;
}
