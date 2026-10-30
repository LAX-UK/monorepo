import type {
  ArtCommerceMutationClient,
  ArtCommerceMutationResult,
} from "@/lib/art-commerce-mutation.server";
import { isCatalogueSlug } from "@/lib/catalogue/catalogue-slug";
import {
  type EnquiryFieldErrors,
  type EnquiryFormInput,
  validateEnquiryForm,
} from "@/lib/enquiry/enquiry-form.validator";

export type ArtEnquiryState =
  | { status: "idle" }
  | { status: "sent"; email: string | null }
  | { status: "invalid"; fieldErrors: EnquiryFieldErrors }
  | { status: "error"; message: string };

const MESSAGES = {
  sessionExpired: "Your session expired. Refresh the page and try again.",
  notFound: "This artwork is no longer available for enquiries.",
  conflict: "This artwork is no longer accepting enquiries.",
  invalid: "Check your details and try again.",
  rateLimited: "You have sent several enquiries recently. Try again in a few minutes.",
  unavailable: "We could not send your enquiry. Try again shortly.",
} as const;

function readError(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

export function interpretArtEnquiryResult(
  result: ArtCommerceMutationResult,
  email: string | null = null,
): ArtEnquiryState {
  if (result.kind === "csrf_unavailable")
    return { status: "error", message: MESSAGES.sessionExpired };
  if (result.kind === "network_error") return { status: "error", message: MESSAGES.unavailable };
  const { status, body } = result;
  if (status >= 200 && status < 300) return { status: "sent", email };
  if (status === 403 && readError(body) === "csrf_failed") {
    return { status: "error", message: MESSAGES.sessionExpired };
  }
  if (status === 404) return { status: "error", message: MESSAGES.notFound };
  if (status === 409) return { status: "error", message: MESSAGES.conflict };
  if (status === 400 || status === 422) return { status: "error", message: MESSAGES.invalid };
  if (status === 429) return { status: "error", message: MESSAGES.rateLimited };
  return { status: "error", message: MESSAGES.unavailable };
}

/** Hidden field that only bots fill; the API drops the enquiry silently when it is set. */
function honeypot(value: unknown): { website?: string } {
  return typeof value === "string" && value.trim() ? { website: value } : {};
}

export async function submitArtEnquiry(
  client: ArtCommerceMutationClient,
  input: { artworkSlug: unknown; website?: unknown } & EnquiryFormInput,
): Promise<ArtEnquiryState> {
  if (!isCatalogueSlug(input.artworkSlug)) {
    return { status: "error", message: MESSAGES.notFound };
  }
  const validation = validateEnquiryForm(input);
  if (!validation.ok) return { status: "invalid", fieldErrors: validation.fieldErrors };
  const result = await client.mutate(
    `/commerce/artworks/${encodeURIComponent(input.artworkSlug.trim())}/interest`,
    { method: "POST", body: { ...validation.payload, ...honeypot(input.website) } },
  );
  return interpretArtEnquiryResult(result, validation.payload.email);
}
