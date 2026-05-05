import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
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

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email address";
  const first = local.slice(0, 1);
  const last = local.length > 1 ? local.slice(-1) : "";
  return `${first}${"*".repeat(Math.max(2, local.length - 2))}${last}@${domain}`;
}
