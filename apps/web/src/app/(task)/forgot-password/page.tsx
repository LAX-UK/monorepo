import { ensureHostedAuthRedirect } from "@/lib/bff/hosted-auth-page.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

const description = "Request a secure link to reset your LAX account password.";

export const metadata: Metadata = metadataForPrivate("Forgot password", description);

export default async function ForgotPasswordPage() {
  await ensureHostedAuthRedirect({
    route: "forgot-password",
    searchParams: new URLSearchParams(),
    authenticatedBypass: false,
  });
}
