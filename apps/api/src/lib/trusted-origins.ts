/** CORS + origin verification allowlist (comma-separated `WEB_ORIGINS` or `[WEB_ORIGIN]`). */
export function trustedWebOrigins(env: {
  WEB_ORIGIN: string;
  WEB_ORIGINS?: string[] | undefined;
}): string[] {
  if (env.WEB_ORIGINS && env.WEB_ORIGINS.length > 0) return env.WEB_ORIGINS;
  return [env.WEB_ORIGIN];
}
