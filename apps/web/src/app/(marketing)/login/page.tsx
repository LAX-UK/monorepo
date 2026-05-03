import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/sign-in-form";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Sign in",
  description: "Sign in to your LAX account to bid, track lots, and manage notifications.",
  path: "/login",
});

function SignInFormFallback() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}

export default function LoginPage() {
  return (
    <main id="main-content">
      <AuthLayout>
        <Suspense fallback={<SignInFormFallback />}>
          <SignInForm />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
