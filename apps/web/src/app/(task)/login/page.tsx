import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthRouteLoading } from "@/components/auth/auth-route-loading";
import { SignInForm } from "@/components/auth/sign-in-form";
import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

const description = "Sign in to your LAX account to bid, track lots, and manage notifications.";

export const metadata: Metadata = metadataForPrivate("Sign in", description);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; switch?: string; verify_pending?: string }>;
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
    <Suspense fallback={<AuthRouteLoading />}>
      <main id="main-content">
        <AuthLayout chrome="task" title="Sign in" description={description}>
          <SignInForm switchAccount={bypass} />
        </AuthLayout>
      </main>
    </Suspense>
  );
}
