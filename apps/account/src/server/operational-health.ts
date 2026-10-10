export function accountLiveHealthBody(): { status: "ok"; release: string } {
  return {
    status: "ok",
    release: process.env.SENTRY_RELEASE ?? "unknown",
  };
}
