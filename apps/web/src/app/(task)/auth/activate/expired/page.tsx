import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthRouteLoading } from "@/components/auth/auth-route-loading";
import { MagicLinkRequestForm } from "@/components/auth/magic-link-request-form";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

const description = "Request a fresh activation link for your London Art Exchange account.";

export const metadata: Metadata = metadataForPrivate("Activation link expired", description);

function linkErrorMessage(errorCode: string | undefined): string | null {
  if (!errorCode) return null;
  if (errorCode === "EXPIRED_TOKEN") {
    return "This activation link has expired. Request a fresh link below — they are valid for 15 minutes.";
  }
  if (errorCode === "ATTEMPTS_EXCEEDED" || errorCode === "INVALID_TOKEN") {
    return "This activation link has already been used or is no longer valid. Request a fresh link below.";
  }
  if (errorCode === "new_user_signup_disabled") {
    return "We could not find an account for this link. If you are new, register first; otherwise request a fresh link below.";
  }
  return "This activation link could not be used. Request a fresh link below.";
}

export default async function ActivateExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const linkError = linkErrorMessage(typeof sp.error === "string" ? sp.error : undefined);

  return (
    <Suspense fallback={<AuthRouteLoading />}>
      <main id="main-content">
        <AuthLayout
          chrome="task"
          title="Activation link expired"
          description="Request a new secure sign-in link to continue."
        >
          <MagicLinkRequestForm linkError={linkError} />
        </AuthLayout>
      </main>
    </Suspense>
  );
}
