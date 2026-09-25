import { ensureHostedAuthRedirect } from "@/lib/bff/hosted-auth-page.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Reset password",
  "Choose a new password for your London Art Exchange account.",
);

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.token) params.set("token", sp.token);
  if (sp.error) params.set("error", sp.error);
  await ensureHostedAuthRedirect({
    route: "reset-password",
    searchParams: params,
    authenticatedBypass: false,
  });
}
