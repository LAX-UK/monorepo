import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

function LoginFormFallback() {
  return (
    <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />
  );
}

export default function LoginPage() {
  return (
    <main id="main-content" className="mx-auto max-w-md px-6 pb-24 pt-28 md:pt-32">
      <h1 className="mb-2 font-headline text-4xl tracking-tight text-on-surface">Sign in</h1>
      <p className="mb-10 font-body text-sm text-on-surface-variant">
        Access your dashboard, bids, and collection.
      </p>
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
