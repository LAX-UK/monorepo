import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Verify email",
  "Confirm your London Art Exchange account email address.",
);

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";
  const email = typeof sp.email === "string" ? sp.email : "";

  if (error) {
    return (
      <main id="main-content">
        <AuthLayout
          title="Verification link expired"
          description="Send yourself a fresh verification link to finish securing your account."
        >
          <div className="flex flex-col gap-6">
            <Alert variant="destructive">
              <AlertDescription>
                This verification link is no longer valid. Send a new link and try again.
              </AlertDescription>
            </Alert>
            {email ? (
              <VerifyPendingActions email={email} />
            ) : (
              <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
                <Link href="/login">Return to sign in</Link>
              </Button>
            )}
          </div>
        </AuthLayout>
      </main>
    );
  }

  return (
    <main id="main-content">
      <AuthLayout
        title="Email verified"
        description="Your account email has been confirmed. You can continue to your dashboard."
      >
        <div className="flex flex-col gap-6">
          <output
            className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
            aria-live="polite"
          >
            Email verified — you&apos;re ready to use London Art Exchange.
          </output>
          <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
            <Link href="/dashboard" prefetch>
              Go to dashboard
            </Link>
          </Button>
        </div>
      </AuthLayout>
    </main>
  );
}
