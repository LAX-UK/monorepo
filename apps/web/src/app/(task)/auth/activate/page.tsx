import { ActivateAccountButton } from "@/components/auth/activate-account-button";
import { AuthLayout } from "@/components/auth/auth-layout";
import { MagicLinkRequestForm } from "@/components/auth/magic-link-request-form";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

const description = "Activate your London Art Exchange account with a secure sign-in link.";

export const metadata: Metadata = metadataForPrivate("Activate account", description);

export default async function ActivateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.trim() : "";

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title={token ? "Activate your account" : "Request activation link"}
        description={
          token
            ? "Click below to activate your account. This link expires in 15 minutes and works once."
            : "Enter your email and we will send a secure sign-in link if your account exists."
        }
      >
        {token ? (
          <div className="flex w-full flex-col gap-8">
            <ActivateAccountButton token={token} />
          </div>
        ) : (
          <Suspense fallback={null}>
            <MagicLinkRequestForm />
          </Suspense>
        )}
      </AuthLayout>
    </main>
  );
}
