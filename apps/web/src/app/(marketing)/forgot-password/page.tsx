import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request a link to reset your password.",
};

export default function ForgotPasswordPage() {
  return (
    <main id="main-content">
      <AuthLayout title="FORGOT PASSWORD">
        <ForgotPasswordForm />
      </AuthLayout>
    </main>
  );
}
