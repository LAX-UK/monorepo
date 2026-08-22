"use client";

import { markContextualKycGateNavigation } from "@/components/onboarding/buyer-onboarding-analytics";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { kycLinkActionLabel } from "@/lib/kyc/kyc-link-action-copy";
import {
  type TelephoneBookingSnapshot,
  telephoneBookingStatusLabel,
} from "@/lib/telephone/telephone-booking-types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { ArrowRight, Phone } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Entity = {
  id: string;
  displayName: string;
  memberRole: string;
};

type Props = {
  isAuthenticated: boolean;
  kycApproved: boolean;
  mobile: string | null;
  phoneNumberVerified?: boolean;
  mobileDisplay?: string | null;
  buyerEntities: Entity[];
  loginNextPath: string;
  orgModuleEnabled?: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
  existingBooking?: TelephoneBookingSnapshot | null;
  children: ReactNode;
};

export function TelephoneParticipationGate({
  isAuthenticated,
  kycApproved,
  mobile,
  phoneNumberVerified = false,
  mobileDisplay,
  buyerEntities,
  loginNextPath,
  orgModuleEnabled = true,
  kycFeedback = null,
  existingBooking = null,
  children,
}: Props) {
  const loginHref = `/login?next=${encodeURIComponent(loginNextPath)}`;
  const kycHref = contextualIdentityOnboardingHref(loginNextPath, "telephone");
  const profileHref = `/dashboard/settings/profile?next=${encodeURIComponent(loginNextPath)}`;

  if (!isAuthenticated) {
    return (
      <div className="space-y-2">
        <p className="font-body text-xs text-on-surface-variant">
          Sign in to request a live telephone bidding line for this sale.
        </p>
        <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
          <Link href={loginHref}>
            Sign in <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>
    );
  }

  if (!kycApproved) {
    return (
      <div className="space-y-2">
        {kycFeedback?.detail ? (
          <p className="font-body text-xs text-on-surface-variant">{kycFeedback.detail}</p>
        ) : null}
        <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
          <Link
            href={kycHref}
            onClick={() => markContextualKycGateNavigation("telephone", loginNextPath)}
          >
            {kycFeedback ? kycLinkActionLabel(kycFeedback, "long") : "Verify identity"}{" "}
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>
    );
  }

  if (!mobile?.trim() || !phoneNumberVerified) {
    return (
      <div className="space-y-2">
        <p className="font-body text-xs text-on-surface-variant">
          {mobile?.trim()
            ? "Verify your contact number so our team can reach you on the telephone line."
            : "Add and verify a contact number so our team can reach you on the line."}
        </p>
        <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
          <Link href={profileHref}>
            {mobile?.trim() ? "Verify mobile number" : "Add mobile number"}{" "}
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>
    );
  }

  if (buyerEntities.length === 0) {
    if (!orgModuleEnabled) {
      return (
        <p className="font-body text-xs text-on-surface-variant">
          Organisation buyer profiles are coming soon.
        </p>
      );
    }
    return (
      <div className="space-y-2">
        <p className="font-body text-xs text-on-surface-variant">
          Set up a buyer profile before requesting a telephone line.
        </p>
        <Button size="sm" variant="outline" className="w-full" asChild>
          <Link href="/onboarding/organisation">Set up buyer profile</Link>
        </Button>
      </div>
    );
  }

  if (existingBooking && existingBooking.status !== "cancelled") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{telephoneBookingStatusLabel(existingBooking.status)}</Badge>
          {mobileDisplay || mobile ? (
            <span className="inline-flex items-center gap-1 font-body text-xs text-on-surface-variant">
              <Phone className="size-3" />
              {mobileDisplay ?? mobile}
            </span>
          ) : null}
        </div>
        <p className="font-body text-xs text-on-surface-variant">
          You already have a telephone booking for this sale. Track status and request limit changes
          from your dashboard.
        </p>
        <Button size="sm" variant="outline" className="w-full" asChild>
          <Link href={`/dashboard/telephone-bids/${existingBooking.id}`}>View booking</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
