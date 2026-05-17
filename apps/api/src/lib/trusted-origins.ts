/** CORS + origin verification allowlist (`WEB_ORIGINS`, `WEB_ORIGIN`, optional `SSR_TRUSTED_ORIGINS`). */
export function trustedWebOrigins(env: {
  WEB_ORIGIN: string;
  WEB_ORIGINS?: string[] | undefined;
  SSR_TRUSTED_ORIGINS?: string[] | undefined;
}): string[] {
  const base =
    env.WEB_ORIGINS && env.WEB_ORIGINS.length > 0 ? [...env.WEB_ORIGINS] : [env.WEB_ORIGIN];
  const extra = env.SSR_TRUSTED_ORIGINS ?? [];
  for (const origin of extra) {
    if (!base.includes(origin)) base.push(origin);
  }
  return base;
}
