import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type PlatformCatalogLegalEntityFailureReason = "not_configured" | "lookup_failed";

export type PlatformCatalogLegalEntityResult =
  | { ok: true; id: string }
  | { ok: false; reason: PlatformCatalogLegalEntityFailureReason };

let cachedPlatformCatalogLegalEntityId: string | undefined;

function configuredPlatformCatalogLegalEntityId(): string | null {
  const configured = process.env.PLATFORM_CATALOG_LEGAL_ENTITY_ID?.trim();
  return configured && configured.length > 0 ? configured : null;
}

function readResolvedId(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("id" in data)) return null;
  const id = (data as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Platform org stamped on staff-created sales (`created_by_legal_entity_id`). */
export async function resolvePlatformCatalogLegalEntity(): Promise<PlatformCatalogLegalEntityResult> {
  const configured = configuredPlatformCatalogLegalEntityId();
  if (configured) return { ok: true, id: configured };

  if (cachedPlatformCatalogLegalEntityId) {
    return { ok: true, id: cachedPlatformCatalogLegalEntityId };
  }

  try {
    const res = await authedServerFetch("/admin/platform-catalog/legal-entity-id");
    if (!res.ok) {
      return { ok: false, reason: "lookup_failed" };
    }
    const body = (await res.json()) as unknown;
    const id = readResolvedId(body);
    if (!id) {
      return { ok: false, reason: "not_configured" };
    }
    cachedPlatformCatalogLegalEntityId = id;
    return { ok: true, id };
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }
}

export function platformCatalogLegalEntityErrorMessage(
  reason: PlatformCatalogLegalEntityFailureReason,
): string {
  if (reason === "lookup_failed") {
    return "Could not resolve the platform catalog organisation.";
  }
  return "Platform catalog organisation is not configured.";
}
