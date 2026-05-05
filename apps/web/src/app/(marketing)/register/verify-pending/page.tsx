import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { redirectIfVerifyPendingNotNeeded } from "@/lib/auth/guards.server";
import { maskEmail } from "@/lib/format/mask-email";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Verify your email",
  "Check your inbox to finish setting up your London Art Exchange account.",
);

export default async function VerifyPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";

  await redirectIfVerifyPendingNotNeeded();

  return (
    <main id="main-content">
      <AuthLayout
        title="Check your inbox"
        description="We've sent you a verification link. Your account will be ready once you confirm your email."
      >
        <div className="flex flex-col gap-8">
          <p className="font-body text-sm text-on-surface-variant">
            We sent the verification email to{" "}
            <span className="font-medium text-on-surface">{maskEmail(email)}</span>.
          </p>
          {email ? <VerifyPendingActions email={email} /> : null}
        </div>
      </AuthLayout>
    </main>
  );
}
