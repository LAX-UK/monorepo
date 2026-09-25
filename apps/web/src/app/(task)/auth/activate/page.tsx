import { ActivateAccountButton } from "@/components/auth/activate-account-button";
import { AuthLayout } from "@/components/auth/auth-layout";
import { buildBidIssuerHostedUrl } from "@/lib/bff/redirect-to-hosted-auth.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

const description = "Activate your London Art Exchange account with a secure sign-in link.";

export const metadata: Metadata = metadataForPrivate("Activate account", description);

export default async function ActivateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.trim() : "";

  if (!token) {
    redirect(buildBidIssuerHostedUrl("/magic-link"));
  }

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="Continue to sign in"
        description="Click below to continue. This link expires in 15 minutes and works once."
      >
        <div className="flex w-full flex-col gap-8">
          <ActivateAccountButton token={token} />
        </div>
      </AuthLayout>
    </main>
  );
}
