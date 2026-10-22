"use server";

import { artCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import {
  type ArtGeneralEnquiryState,
  submitGeneralEnquiry,
} from "@/lib/enquiry/submit-general-enquiry";

export async function sendArtGeneralEnquiry(
  contextSlug: string | null,
  _previous: ArtGeneralEnquiryState,
  formData: FormData,
): Promise<ArtGeneralEnquiryState> {
  return submitGeneralEnquiry(artCommerceMutationClient, {
    topic: formData.get("topic"),
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
    phone: formData.get("contactPhone"),
    website: formData.get("website"),
    contextSlug,
  });
}
