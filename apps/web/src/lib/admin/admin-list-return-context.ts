import { buildListHref } from "@/lib/admin/admin-list-params";

/** Preserves originating list URL (path + query) when navigating to detail workspaces. */
export const ADMIN_LIST_RETURN_TO_PARAM = "returnTo";

const DEFAULT_ALLOWED_PREFIXES = [
  "/admin/compliance/aml",
  "/admin/compliance/source-of-funds",
  "/admin/condition-reports",
  "/admin/lot-fulfilment",
  "/admin/invitations",
  "/admin/clients",
  "/admin/staff",
  "/admin/legal-entities",
  "/admin/onboarding-issues",
] as const;

export function buildAdminListReturnTarget(
  basePath: string,
  sp: Record<string, string | string[] | undefined>,
): string {
  return buildListHref(basePath, sp, {});
}

export function parseAdminListReturnTarget(
  raw: string | string[] | undefined,
  fallback: string,
  allowedPrefixes: readonly string[] = DEFAULT_ALLOWED_PREFIXES,
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("//")) return fallback;
  const pathOnly = trimmed.split("?")[0] ?? trimmed;
  const allowed = allowedPrefixes.some(
    (prefix) => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`),
  );
  return allowed ? trimmed : fallback;
}
