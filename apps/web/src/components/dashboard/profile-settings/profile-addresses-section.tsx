"use client";

import { SettingsSection } from "@/components/dashboard/settings-section";
import { SettingsTag } from "@/components/dashboard/settings-tag";
import type { ProfileAddressRow } from "@/lib/data/dto/profile-dtos";
import { Separator } from "@auction/ui/components/separator";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { AddAddressBlock } from "./add-address-block";
import { addressTypeTags } from "./profile-settings-helpers";

export function ProfileAddressesSection({ addresses }: { addresses: ProfileAddressRow[] }) {
  return (
    <SettingsSection
      title="Address management"
      action={
        <Link
          href="/dashboard/settings/addresses"
          className="inline-flex items-center gap-1 font-label text-sm font-semibold text-on-surface underline underline-offset-2"
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </Link>
      }
    >
      {addresses.length === 0 ? (
        <p className="font-body text-sm text-on-surface-variant">No addresses yet.</p>
      ) : (
        <ul className="space-y-6">
          {addresses.map((a, index) => (
            <li
              key={a.id}
              className="rounded-xl border border-border-hairline bg-surface-container-lowest p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-label text-sm font-bold uppercase tracking-wide text-on-surface">
                  {a.label || `Address ${index + 1}`}
                </span>
                <Link
                  href="/dashboard/settings/addresses"
                  className="font-label text-sm font-semibold text-on-surface underline underline-offset-2"
                >
                  Edit
                </Link>
              </div>
              <p className="mt-3 font-body text-base leading-6 text-on-surface">
                {a.line1}
                {a.line2 ? (
                  <>
                    <br />
                    {a.line2}
                  </>
                ) : null}
                <br />
                {a.city}
                {a.state ? `, ${a.state}` : ""} {a.postalCode}
                <br />
                {a.country}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {addressTypeTags(a).map((t) => (
                  <SettingsTag key={t.key} variant="outline">
                    {t.label}
                  </SettingsTag>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Separator className="bg-outline-variant/20" />
      <AddAddressBlock />
    </SettingsSection>
  );
}
