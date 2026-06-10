import { AuthLayout } from "@/components/auth/auth-layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { OrgModuleComingSoon } from "@/components/organisations/org-module-coming-soon";
import { invitationRoleLabel } from "@/lib/admin/invitation-role-label";
import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { fetchInvitePreview } from "@/lib/auth/invite-preview.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { resolvePhoneDefaultCountry } from "@/lib/phone/resolve-phone-default-country";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

const description =
  "Create an account to bid on curated fine art auctions and manage your collection.";

export const metadata: Metadata = metadataForPrivate("Sign up", description);

function SignUpFormFallback() {
  return <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />;
}

function InviteProblem({ reason }: { reason: "invalid" | "expired" }) {
  const title = reason === "expired" ? "Invitation expired" : "Invitation not found";
  const body =
    reason === "expired"
      ? "This invitation link has expired. Ask the person who invited you to resend it — you'll receive a fresh link by email."
      : "This invitation link is invalid or has already been used. Ask the person who invited you to send a new one.";
  return (
    <main id="main-content">
      <AuthLayout chrome="task" title={title} description="Your invitation link needs attention.">
        <div className="flex flex-col gap-6">
          <Alert variant="destructive">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{body}</AlertDescription>
          </Alert>
          <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    </main>
  );
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const inviteToken = typeof sp.invite === "string" && sp.invite.length > 0 ? sp.invite : undefined;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const phoneDefaultCountry = await resolvePhoneDefaultCountry();

  let invitePreview: {
    email: string;
    roleLabel: string;
    entityScoped: boolean;
  } | null = null;

  if (inviteToken != null) {
    const result = await fetchInvitePreview(inviteToken);
    if (!result.ok && (result.reason === "invalid" || result.reason === "expired")) {
      return <InviteProblem reason={result.reason} />;
    }
    if (result.ok) {
      if (result.preview.entityScoped && !orgModuleEnabled) {
        // Organisation membership invites stay gated until the org module launches.
        return (
          <main id="main-content">
            <AuthLayout chrome="task" title="Sign up" description={description}>
              <OrgModuleComingSoon />
            </AuthLayout>
          </main>
        );
      }
      invitePreview = {
        email: result.preview.email,
        roleLabel: invitationRoleLabel(result.preview.targetRole, result.preview.targetStaffRole),
        entityScoped: result.preview.entityScoped,
      };
    }
    // Preview unavailable (API hiccup): fail open and render the form —
    // registration re-validates the token server-side at submit.
  }

  if (inviteToken == null) {
    await redirectIfAuthenticated({
      route: "register",
      ...(next !== undefined ? { next } : {}),
    });
  }
  return (
    <main id="main-content">
      <AuthLayout chrome="task" title="Sign up" description={description}>
        <Suspense fallback={<SignUpFormFallback />}>
          <SignUpForm
            {...(inviteToken != null ? { inviteToken } : {})}
            {...(invitePreview != null ? { invitePreview } : {})}
            orgModuleEnabled={orgModuleEnabled}
            phoneDefaultCountry={phoneDefaultCountry}
          />
        </Suspense>
      </AuthLayout>
    </main>
  );
}
