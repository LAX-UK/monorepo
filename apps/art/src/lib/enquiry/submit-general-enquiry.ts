import type {
  ArtCommerceMutationClient,
  ArtCommerceMutationResult,
} from "@/lib/art-commerce-mutation.server";

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
  | { status: "invalid"; message: string }
  | { status: "sign_in_required" }
  | { status: "sent" }
  | { status: "error"; message: string };

const MESSAGE_MAX = 4000;
const PHONE_MAX = 40;
const CONTEXT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isArtGeneralEnquiryTopic(value: string): value is ArtGeneralEnquiryTopic {
  return ART_GENERAL_ENQUIRY_TOPICS.some((topic) => topic.value === value);
}

export async function submitGeneralEnquiry(
  client: ArtCommerceMutationClient,
  input: { topic: unknown; message: unknown; phone: unknown; contextSlug?: unknown },
): Promise<ArtGeneralEnquiryState> {
  const topic = String(input.topic ?? "general");
  if (!isArtGeneralEnquiryTopic(topic)) {
    return { status: "invalid", message: "Choose a topic for your enquiry." };
  }
  const message = String(input.message ?? "").trim();
  if (message.length < 1 || message.length > MESSAGE_MAX) {
    return { status: "invalid", message: `Enter a message up to ${MESSAGE_MAX} characters.` };
  }
  const phone = String(input.phone ?? "").trim();
  if (phone.length > PHONE_MAX) {
    return { status: "invalid", message: "Enter a shorter phone number." };
  }
  const contextSlug = String(input.contextSlug ?? "").trim();
  const result: ArtCommerceMutationResult = await client.mutate("/commerce/me/general-enquiries", {
    method: "POST",
    body: {
      topic,
      message,
      ...(phone ? { phone } : {}),
      ...(CONTEXT_SLUG.test(contextSlug) ? { contextSlug } : {}),
    },
  });
  if (result.kind === "response" && result.status === 401) return { status: "sign_in_required" };
  if (result.kind === "response" && result.status === 201) return { status: "sent" };
  return { status: "error", message: "We could not send your enquiry. Try again shortly." };
}
