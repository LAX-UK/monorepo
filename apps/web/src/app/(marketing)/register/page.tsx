import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Sign up",
  description: "Create an account to bid on curated fine art auctions and manage your collection.",
  path: "/register",
});

function SignUpFormFallback() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken =
    typeof sp.invite === "string" && sp.invite.length > 0 ? sp.invite : undefined;
  return (
    <main id="main-content">
      <AuthLayout title="SIGN UP">
        <Suspense fallback={<SignUpFormFallback />}>
          <SignUpForm {...(inviteToken != null ? { inviteToken } : {})} />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
