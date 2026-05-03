import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Forgot password",
  description: "Request a secure link to reset your LAX account password.",
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <main id="main-content">
      <AuthLayout>
        <ForgotPasswordForm />
      </AuthLayout>
    </main>
  );
}
