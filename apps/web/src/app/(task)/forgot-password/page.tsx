import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthRouteLoading } from "@/components/auth/auth-route-loading";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

const description = "Request a secure link to reset your LAX account password.";

export const metadata: Metadata = metadataForPrivate("Forgot password", description);

export default async function ForgotPasswordPage() {
  await redirectIfAuthenticated({ route: "forgot-password" });
  return (
    <Suspense fallback={<AuthRouteLoading />}>
      <main id="main-content">
        <AuthLayout chrome="task" title="Forgot password" description={description}>
          <ForgotPasswordForm />
        </AuthLayout>
      </main>
    </Suspense>
  );
}
