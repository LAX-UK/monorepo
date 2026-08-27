import { AuthLayout } from "@/components/auth/auth-layout";
import { VerifyEmailSuccessRedirect } from "@/components/auth/verify-email-success-redirect";
import { VerifyPendingActions } from "@/components/auth/verify-pending-actions";
import { resolvePostVerifyDestination } from "@/lib/auth/post-verify-destination";
import { tryConsumePendingInviteAfterVerify } from "@/lib/auth/post-verify-invite.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { isFullBuyerOnboardingEnabled } from "@/lib/kyc/full-buyer-onboarding-rollout.server";
import { isIdentityOnboardingEnabled } from "@/lib/kyc/identity-onboarding-rollout.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import {
  type UserRole,
  canAccessStaffAdminShell,
  staffRoleDefaultDestination,
} from "@auction/types";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Verify email",
  "Confirm your London Art Exchange account email address.",
);

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    email?: string;
    next?: string;
    persona?: string;
    invite?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";
  const email = typeof sp.email === "string" ? sp.email : "";
  const queryNext = typeof sp.next === "string" ? sp.next : null;
  const queryPersona = typeof sp.persona === "string" ? sp.persona : null;

  const queryInvite = typeof sp.invite === "string" && sp.invite.length > 0 ? sp.invite : null;

  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const identityOnboardingEnabled = isIdentityOnboardingEnabled();
  const fullBuyerOnboardingEnabled = isFullBuyerOnboardingEnabled();
  const sessionUser = await getServerSessionUser();

  // Invited staff land straight in the admin shell instead of bouncing
  // through the client dashboard redirect.
  const destination =
    sessionUser && canAccessStaffAdminShell(sessionUser.role as UserRole)
      ? {
          href: staffRoleDefaultDestination(
            sessionUser.role as UserRole,
            sessionUser.staffRole ?? null,
          ),
          label: "Continue to admin",
        }
      : resolvePostVerifyDestination({
          requestedNext: queryNext,
          queryPersona,
          sessionPersona: sessionUser?.signupPersona ?? null,
          orgModuleEnabled,
          identityOnboardingEnabled,
          fullBuyerOnboardingEnabled,
          ...(sessionUser?.categoryInterestsOnboardingCompletedAt !== undefined
            ? {
                categoryInterestsOnboardingCompletedAt:
                  sessionUser.categoryInterestsOnboardingCompletedAt,
              }
            : {}),
          ...(sessionUser?.kycStatus !== undefined ? { kycStatus: sessionUser.kycStatus } : {}),
        });

  if (error) {
    return (
      <main id="main-content">
        <AuthLayout
          chrome="task"
          title="Verification link expired"
          description="Send yourself a fresh verification link to finish securing your account."
        >
          <div className="flex flex-col gap-6">
            <Alert variant="destructive">
              <AlertDescription>
                This verification link is no longer valid. Send a new link and try again.
              </AlertDescription>
            </Alert>
            {email ? (
              <VerifyPendingActions email={email} />
            ) : (
              <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
                <Link href="/login">Return to sign in</Link>
              </Button>
            )}
          </div>
        </AuthLayout>
      </main>
    );
  }

  const verified = sessionUser?.emailVerified === true;

  if (!verified) {
    return (
      <main id="main-content">
        <AuthLayout
          chrome="task"
          title="Verify your email"
          description="Open the verification link we sent to your inbox to finish setting up your account."
        >
          <div className="flex flex-col gap-6">
            {email ? (
              <VerifyPendingActions email={email} {...(queryNext ? { next: queryNext } : {})} />
            ) : (
              <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
                <Link href="/login">Return to sign in</Link>
              </Button>
            )}
          </div>
        </AuthLayout>
      </main>
    );
  }

  if (sessionUser?.id && orgModuleEnabled) {
    const consumed = await tryConsumePendingInviteAfterVerify(queryInvite);
    if (consumed) {
      redirect(consumed.redirectTo);
    }
  }

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="Email verified"
        description="Your account email has been confirmed. You can continue to your dashboard."
      >
        <div className="flex flex-col gap-6">
          <output
            className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
            aria-live="polite"
          >
            Email verified — you&apos;re ready to use London Art Exchange.
          </output>
          <VerifyEmailSuccessRedirect href={destination.href} />
          <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
            <Link href={destination.href} prefetch>
              {destination.label}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    </main>
  );
}
