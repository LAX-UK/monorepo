import { buildBidIssuerHostedUrl } from "@/lib/bff/redirect-to-hosted-auth.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

const description = "Request a fresh activation link for your London Art Exchange account.";

export const metadata: Metadata = metadataForPrivate("Activation link expired", description);

export default function ActivateExpiredPage() {
  redirect(buildBidIssuerHostedUrl("/magic-link"));
}
