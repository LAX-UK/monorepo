import type {
  ArtCommerceMutationClient,
  ArtCommerceMutationResult,
} from "@/lib/art-commerce-mutation.server";
import {
  ENQUIRY_PHONE_MAX_LENGTH,
  type EnquiryFieldErrors,
  type EnquiryFormInput,
  readEnquiryText,
  validateEnquiryContact,
} from "@/lib/enquiry/enquiry-form.validator";
import { readEnquiryReference } from "@/lib/enquiry/enquiry-reference";

export const ART_GENERAL_ENQUIRY_TOPICS = [
  { value: "general", label: "General enquiry" },
  { value: "private_viewing", label: "Private viewing" },
  { value: "art_advisory", label: "Art advisory" },
  { value: "selling", label: "Selling with LAX" },
  { value: "exhibition", label: "Exhibition" },
] as const;

export type ArtGeneralEnquiryTopic = (typeof ART_GENERAL_ENQUIRY_TOPICS)[number]["value"];

export type ArtGeneralEnquiryState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: EnquiryFieldErrors & { topic?: string } }
  | { status: "sent"; email: string | null; reference: string | null }
  | { status: "error"; message: string };

const MESSAGE_MAX = 4000;
const CONTEXT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MESSAGES = {
  sessionExpired: "Your session expired. Refresh the page and try again.",
  rateLimited: "You have sent several enquiries recently. Try again in a few minutes.",
  unavailable: "We could not send your enquiry. Try again shortly.",
} as const;

export function isArtGeneralEnquiryTopic(value: string): value is ArtGeneralEnquiryTopic {
  return ART_GENERAL_ENQUIRY_TOPICS.some((topic) => topic.value === value);
}

function interpretResult(result: ArtCommerceMutationResult, email: string): ArtGeneralEnquiryState {
  if (result.kind === "csrf_unavailable") {
    return { status: "error", message: MESSAGES.sessionExpired };
  }
  if (result.kind === "network_error") return { status: "error", message: MESSAGES.unavailable };
  if (result.status === 201) {
    return { status: "sent", email, reference: readEnquiryReference(result.body) };
  }
  if (result.status === 429) return { status: "error", message: MESSAGES.rateLimited };
  return { status: "error", message: MESSAGES.unavailable };
}

export async function submitGeneralEnquiry(
  client: ArtCommerceMutationClient,
  input: {
    topic: unknown;
    phone: unknown;
    contextSlug?: unknown;
    website?: unknown;
  } & Pick<EnquiryFormInput, "name" | "email" | "message">,
): Promise<ArtGeneralEnquiryState> {
  const fieldErrors: EnquiryFieldErrors & { topic?: string } = validateEnquiryContact(input);
  const topic = String(input.topic ?? "general");
  if (!isArtGeneralEnquiryTopic(topic)) fieldErrors.topic = "Choose a topic for your enquiry.";
  const message = readEnquiryText(input.message).trim();
  if (message.length < 1) fieldErrors.message = "Enter a message.";
  else if (message.length > MESSAGE_MAX) {
    fieldErrors.message = `Keep your message under ${MESSAGE_MAX} characters.`;
  }
  const phone = readEnquiryText(input.phone).trim();
  if (phone.length > ENQUIRY_PHONE_MAX_LENGTH)
    fieldErrors.contactPhone = "Enter a shorter phone number.";
  if (Object.keys(fieldErrors).length > 0) return { status: "invalid", fieldErrors };

  const contextSlug = readEnquiryText(input.contextSlug).trim();
  const website = readEnquiryText(input.website);
  const email = readEnquiryText(input.email).trim();
  const result = await client.mutate("/commerce/me/general-enquiries", {
    method: "POST",
    body: {
      topic,
      name: readEnquiryText(input.name).trim(),
      email,
      message,
      ...(phone ? { phone } : {}),
      ...(CONTEXT_SLUG.test(contextSlug) ? { contextSlug } : {}),
      ...(website.trim() ? { website } : {}),
    },
  });
  return interpretResult(result, email);
}
