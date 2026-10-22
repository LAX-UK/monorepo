"use server";

import { artCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import { type ArtEnquiryState, submitArtEnquiry } from "@/lib/enquiry/submit-art-enquiry";

/** `useActionState` handler for the artwork enquiry sheet; bind the slug on the client. */
export async function sendArtEnquiry(
  artworkSlug: string,
  _previous: ArtEnquiryState,
  formData: FormData,
): Promise<ArtEnquiryState> {
  return submitArtEnquiry(artCommerceMutationClient, {
    artworkSlug,
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    website: formData.get("website"),
    contactPhone: formData.get("contactPhone"),
  });
}
