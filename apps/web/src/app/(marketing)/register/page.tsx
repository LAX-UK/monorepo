import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

const description =
  "Create an account to bid on curated fine art auctions and manage your collection.";

export const metadata: Metadata = metadataForPrivate("Sign up", description);

function SignUpFormFallback() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken = typeof sp.invite === "string" && sp.invite.length > 0 ? sp.invite : undefined;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  if (inviteToken == null) {
    await redirectIfAuthenticated({
      route: "register",
      ...(next !== undefined ? { next } : {}),
    });
  }
  return (
    <main id="main-content">
      <AuthLayout title="Sign up" description={description}>
        <Suspense fallback={<SignUpFormFallback />}>
          <SignUpForm {...(inviteToken != null ? { inviteToken } : {})} />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
