import { artCommerceRequest } from "@/lib/art-commerce-request.server";

export type CommerceCsrfResult = { ok: true; token: string } | { ok: false };

export async function fetchArtCommerceCsrfForMutation(): Promise<CommerceCsrfResult> {
  try {
    const response = await artCommerceRequest("/commerce/csrf", {}, { applyCookies: true });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as { csrfToken?: string };
    const token = typeof body.csrfToken === "string" ? body.csrfToken : "";
    if (!token) return { ok: false };
    return { ok: true, token };
  } catch {
    return { ok: false };
  }
}

export type ArtCommerceMutationMethod = "POST" | "PUT" | "DELETE";

export type ArtCommerceMutationResult =
  | { kind: "csrf_unavailable" }
  | { kind: "network_error" }
  | { kind: "response"; status: number; body: unknown };

/** Port for CSRF-protected writes through the art-identity BFF (`/commerce/*`). */
export type ArtCommerceMutationClient = {
  mutate(
    path: string,
    init: { method: ArtCommerceMutationMethod; body?: unknown },
  ): Promise<ArtCommerceMutationResult>;
};

export const artCommerceMutationClient: ArtCommerceMutationClient = {
  async mutate(path, { method, body }) {
    const csrf = await fetchArtCommerceCsrfForMutation();
    if (!csrf.ok) return { kind: "csrf_unavailable" };
    try {
      const response = await artCommerceRequest(
        path,
        {
          method,
          headers: {
            accept: "application/json",
            ...(body !== undefined ? { "content-type": "application/json" } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
        { applyCookies: true, csrfToken: csrf.token },
      );
      const parsed: unknown = await response.json().catch(() => null);
      return { kind: "response", status: response.status, body: parsed };
    } catch {
      return { kind: "network_error" };
    }
  },
};
