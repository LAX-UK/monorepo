import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { VerifyPendingMissingEmail } from "@/components/auth/verify-pending-missing-email";
import { redirectIfVerifyPendingNotNeeded } from "@/lib/auth/guards.server";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { getServerSessionUser } from "@/lib/data/http/session.server";
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
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const user = await getServerSessionUser();
  const email = user?.email ?? (typeof sp.email === "string" ? sp.email : "");
  const rawNext = typeof sp.next === "string" ? sp.next : "";
  const next = isSafeNextPath(rawNext) ? rawNext : undefined;

  await redirectIfVerifyPendingNotNeeded();

  if (!email) {
    return <VerifyPendingMissingEmail />;
  }

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="Check your inbox"
        description="We've sent you a verification link. Your account will be ready once you confirm your email."
      >
        <div className="flex flex-col gap-8">
          <p className="font-body text-sm text-on-surface-variant">
            We sent the verification email to{" "}
            <span className="font-medium text-on-surface">{maskEmail(email)}</span>.
          </p>
          <VerifyPendingActions email={email} {...(next ? { next } : {})} />
        </div>
      </AuthLayout>
    </main>
  );
}
