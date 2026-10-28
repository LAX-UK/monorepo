import type { ArtCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import {
  parseArtistApplicationPresign,
  parseMyArtistApplication,
  parseMyArtistApplicationState,
} from "@auction/shop-contracts";
import type { ArtistApplicationGateway, ArtistApplicationResult } from "./artist-application.port";

const BASE = "/commerce/me/artist-application";
const UPLOAD_TIMEOUT_MS = 60_000;

type Reader = (path: string) => Promise<Response>;

function messageOf(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "That did not work. Try again.";
}

/** Turns a BFF answer into a result, parsing a success with the contract's parser. */
function interpret<T>(
  status: number,
  body: unknown,
  parse: (value: unknown) => T,
): ArtistApplicationResult<T> {
  if (status === 401) return { kind: "signed_out" };
  if (status >= 200 && status < 300) {
    try {
      return { kind: "ok", value: parse(body) };
    } catch {
      return { kind: "unavailable" };
    }
  }
  if (status >= 400 && status < 500) {
    return { kind: "refused", status, message: messageOf(body), blockers: null };
  }
  return { kind: "unavailable" };
}

/**
 * The application API through the lax.art identity BFF, as the signed-in visitor. Writes carry
 * the commerce CSRF token. An image goes to storage from this server, not the browser, so the
 * upload needs no storage CORS rule for lax.art and the signed address never reaches the page.
 */
export function createBffArtistApplicationGateway(deps: {
  read: Reader;
  mutation: ArtCommerceMutationClient;
  putObject?: typeof fetch;
}): ArtistApplicationGateway {
  const putObject = deps.putObject ?? fetch;

  async function write<T>(
    path: string,
    method: "POST" | "PUT",
    body: unknown,
    parse: (value: unknown) => T,
  ): Promise<ArtistApplicationResult<T>> {
    const result = await deps.mutation.mutate(path, { method, body });
    if (result.kind === "csrf_unavailable") return { kind: "signed_out" };
    if (result.kind === "network_error") return { kind: "unavailable" };
    return interpret(result.status, result.body, parse);
  }

  return {
    async readState() {
      try {
        const response = await deps.read(BASE);
        const body: unknown = await response.json().catch(() => null);
        return interpret(response.status, body, parseMyArtistApplicationState);
      } catch {
        return { kind: "unavailable" };
      }
    },

    start: () => write(BASE, "POST", {}, parseMyArtistApplication),

    save: (id, body) => write(`${BASE}/${id}`, "PUT", body, parseMyArtistApplication),

    submit: (id, expectedVersion) =>
      write(`${BASE}/${id}/submit`, "POST", { expectedVersion }, parseMyArtistApplication),

    async uploadImage(id, image) {
      const signed = await write(
        `${BASE}/${id}/images/presign`,
        "POST",
        { contentType: image.contentType, byteSize: image.bytes.byteLength },
        parseArtistApplicationPresign,
      );
      if (signed.kind !== "ok") return signed;
      try {
        const stored = await putObject(signed.value.uploadUrl, {
          method: "PUT",
          headers: { ...signed.value.requiredHeaders, "content-type": image.contentType },
          body: image.bytes,
          signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        });
        if (!stored.ok) return { kind: "unavailable" };
      } catch {
        return { kind: "unavailable" };
      }
      return write(
        `${BASE}/${id}/images/confirm`,
        "POST",
        { key: signed.value.key },
        parseMyArtistApplication,
      );
    },
  };
}
