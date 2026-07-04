"use client";

import { SettingsField } from "@/components/dashboard/settings-field";
import { SettingsSection } from "@/components/dashboard/settings-section";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import { PersonalMobileBlock } from "./profile-settings/personal-mobile-block";
import { PersonalNameBlock } from "./profile-settings/personal-name-block";
import { ProfileAddressesSection } from "./profile-settings/profile-addresses-section";
import { ProfileAvatarBlock } from "./profile-settings/profile-avatar-block";
import { emailStatusLabel, emailStatusVariant } from "./profile-settings/profile-settings-helpers";

type Props = {
  initialName: string;
  initialImage: string | null;
  initialMobile: string | null;
  initialMobileCountry: string | null;
  phoneDefaultCountry: string;
  phoneNumberVerified?: boolean;
  addresses: ProfileAddressRow[];
  /** When set, shows email + verification in Personal details */
  email?: string;
  emailVerified?: boolean;
  emailStatus?: string;
};

export function ProfileSettingsBoard({
  initialName,
  initialImage,
  initialMobile,
  initialMobileCountry,
  phoneDefaultCountry,
  phoneNumberVerified,
  addresses,
  email,
  emailVerified,
  emailStatus,
}: Props) {
  return (
    <div className="space-y-10">
      <ProfileAvatarBlock initialImage={initialImage} />

      <div className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6">
        <SettingsSection title="Personal details" eyebrow bordered={false}>
          <div className="space-y-6">
            <PersonalNameBlock initialName={initialName} />
            {email ? (
              <SettingsField
                label="Email address"
                action={
                  <Link
                    href="/dashboard/settings/account"
                    className="font-label text-sm font-semibold text-on-surface underline underline-offset-2"
                  >
                    Edit
                  </Link>
                }
                value={email}
                valueAccessory={
                  <StatusBadge variant={emailStatusVariant(emailStatus, emailVerified)} size="sm">
                    {emailStatusLabel(emailStatus, emailVerified)}
                  </StatusBadge>
                }
              />
            ) : null}
          </div>
        </SettingsSection>
      </div>

      <ProfileAddressesSection addresses={addresses} />

      <SettingsSection title="Phone" bordered={false}>
        <PersonalMobileBlock
          initialMobile={initialMobile}
          initialMobileCountry={initialMobileCountry}
          phoneDefaultCountry={phoneDefaultCountry}
          {...(phoneNumberVerified !== undefined ? { phoneNumberVerified } : {})}
        />
      </SettingsSection>

      <SettingsSection
        title="Payment method"
        bordered={false}
        action={
          <Link
            href="/dashboard/settings/payment-methods"
            className="inline-flex items-center gap-1 font-label text-sm font-semibold text-on-surface underline underline-offset-2"
          >
            <CreditCard className="size-3.5" aria-hidden />
            Manage
          </Link>
        }
      >
        <p className="font-body text-sm text-on-surface-variant">
          Cards are saved during checkout and used for future invoices. View saved cards on the
          payment methods page.
        </p>
      </SettingsSection>
    </div>
  );
}
