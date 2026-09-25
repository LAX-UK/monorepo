import { AccountOnboardingForm } from "@/components/auth/account-onboarding-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { resolveServerPostAuthDestination } from "@/lib/auth/post-auth-destination.server";
import { readOnboardingInviteTokenFromStore } from "@/lib/bff/onboarding-invite-cookie.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolvePhoneDefaultCountry } from "@/lib/phone/resolve-phone-default-country";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = metadataForPrivate(
  "Finish setting up your account",
  "Tell us how you plan to use London Art Exchange and accept our Conditions of Business.",
);

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export default async function AccountOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const inviteFromCookie = readOnboardingInviteTokenFromStore(await cookies());
  const [params, user] = await Promise.all([searchParams, getServerSessionUser()]);
  if (!user) {
    const loginParams = new URLSearchParams({ next: "/onboarding/account" });
    redirect(`/login?${loginParams.toString()}`);
  }
  if (user.accountOnboardingComplete !== false) {
    redirect(
      resolveServerPostAuthDestination({
        user,
        requestedNext: params.next,
        context: "sign-in",
      }),
    );
  }
  const requestedNext = isSafeNextPath(params.next) ? params.next : null;
  const nextPath = resolveServerPostAuthDestination({
    user: { ...user, accountOnboardingComplete: true },
    requestedNext,
    context: "sign-in",
  });
  const { firstName, lastName } = splitName(user.name ?? "");
  const phoneDefaultCountry = await resolvePhoneDefaultCountry(null);

  return (
    <main id="main-content">
      <AuthLayout
        chrome="task"
        title="Finish setting up your account"
        description="We need a few details before you can bid or sell on LAX."
      >
        <AccountOnboardingForm
          defaultFirstName={firstName}
          defaultLastName={lastName}
          inviteToken={inviteFromCookie}
          nextPath={nextPath}
          phoneDefaultCountry={phoneDefaultCountry}
        />
      </AuthLayout>
    </main>
  );
}
