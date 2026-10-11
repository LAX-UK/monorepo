export function laxAccountPortalHref(path = "/account"): string | null {
  const origin = process.env.NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN?.trim().replace(/\/+$/, "");
  if (!origin) return null;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
