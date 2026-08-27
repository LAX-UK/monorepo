import { MagicLinkLoginSync } from "@/components/analytics/magic-link-login-sync";
import { ActivateSetPasswordForm } from "@/components/auth/activate-set-password-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthRouteLoading } from "@/components/auth/auth-route-loading";
import { resolveServerPostAuthDestination } from "@/lib/auth/post-auth-destination.server";
import { isSafeNextPath } from "@/lib/auth/safe-next-path";
import { getServerHasPassword } from "@/lib/data/http/password-status.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata = metadataForPrivate(
  "Set a password",
  "Choose a password for faster sign-in on London Art Exchange.",
);

export default async function ActivateSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const [user, hasPassword] = await Promise.all([getServerSessionUser(), getServerHasPassword()]);
  if (!user) {
    redirect("/login?auth=required&next=/auth/activate/set-password");
  }
  if (user.suspended === true) {
    redirect("/account-suspended");
  }

  if (hasPassword) {
    const requestedNext = sp.next;
    const safeNext = isSafeNextPath(requestedNext) ? requestedNext : undefined;
    redirect(
      resolveServerPostAuthDestination({
        user,
        ...(safeNext ? { requestedNext: safeNext } : {}),
        context: "sign-in",
        requireEmailVerification: false,
      }),
    );
  }

  return (
    <Suspense fallback={<AuthRouteLoading />}>
      <main id="main-content">
        <AuthLayout
          chrome="task"
          title="Set a password"
          description="Optional — you can skip and continue into the auction."
        >
          <MagicLinkLoginSync />
          <ActivateSetPasswordForm serverConfirmedNoPassword />
        </AuthLayout>
      </main>
    </Suspense>
  );
}
