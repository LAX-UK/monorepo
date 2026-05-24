import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordWithUrlStrip } from "@/components/auth/reset-password-with-url-strip";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Reset password",
  "Choose a new password for your London Art Exchange account.",
);

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="Set a new password"
        description="Choose a strong password to finish resetting your account."
      >
        {token ? (
          <ResetPasswordWithUrlStrip token={token} />
        ) : (
          <div className="flex flex-col gap-6">
            <Alert variant="destructive">
              <AlertDescription>
                This reset link is missing its token. Request a new password reset link to continue.
              </AlertDescription>
            </Alert>
            <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
              <Link href="/forgot-password">Request reset link</Link>
            </Button>
          </div>
        )}
      </AuthLayout>
    </main>
  );
}
