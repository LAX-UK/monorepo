import { AuthLayout } from "@/components/auth/auth-layout";
import { SignInForm } from "@/components/auth/sign-in-form";
import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

const description = "Sign in to your LAX account to bid, track lots, and manage notifications.";

export const metadata: Metadata = metadataForPrivate("Sign in", description);

function SignInFormFallback() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; switch?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const bypass = sp.switch === "1";
  await redirectIfAuthenticated({
    route: "login",
    ...(next !== undefined ? { next } : {}),
    bypass,
  });

  return (
    <main id="main-content">
      <AuthLayout title="Sign in" description={description}>
        <Suspense fallback={<SignInFormFallback />}>
          <SignInForm switchAccount={bypass} />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
