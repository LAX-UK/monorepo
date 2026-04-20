import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Suspense } from "react";

function SignInFormFallback() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}

export default function LoginPage() {
  return (
    <main id="main-content">
      <AuthLayout title="SIGN IN">
        <Suspense fallback={<SignInFormFallback />}>
          <SignInForm />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
