import { AuthLayout } from "@/components/auth/auth-layout";
import { TwoFactorVerifyForm } from "@/components/auth/two-factor-verify-form";
import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

/** Better Auth sets this while a credential sign-in awaits the TOTP step. */
const PENDING_TWO_FACTOR_COOKIES = [
  "better-auth.two_factor",
  "__Secure-better-auth.two_factor",
] as const;

const description =
  "Enter the 6-digit code from your authenticator app to finish signing in to your LAX account.";

export const metadata: Metadata = metadataForPrivate("Two-step verification", description);

export default async function LoginTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : "/dashboard";
  const next = isSafeNextPath(rawNext) ? rawNext : "/dashboard";
  await redirectIfAuthenticated({ route: "login", next });

  // Direct navigation without a pending 2FA challenge would only dead-end in
  // "session expired" on submit — send the user back to sign in instead.
  const cookieStore = await cookies();
  const hasPendingChallenge = PENDING_TWO_FACTOR_COOKIES.some((name) =>
    Boolean(cookieStore.get(name)?.value),
  );
  if (!hasPendingChallenge) {
    redirect(`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  return (
    <main id="main-content">
      <AuthLayout chrome="task" title="Two-step verification" description={description}>
        <Suspense fallback={null}>
          <TwoFactorVerifyForm nextHref={next} />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
