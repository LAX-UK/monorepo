/** Platform liveness payload — no OIDC/Shop API deps (composition-root env only). */
export function shopAdminLiveHealthBody(): { status: "ok"; release: string } {
  return {
    status: "ok",
    release: process.env.SENTRY_RELEASE ?? "unknown",
  };
}
