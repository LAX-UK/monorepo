import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create an account to bid on curated fine art auctions.",
};

export default function RegisterPage() {
  return (
    <main id="main-content">
      <AuthLayout title="SIGN UP">
        <SignUpForm />
      </AuthLayout>
    </main>
  );
}
