import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { DisplayHeading } from "@/components/ui/typography";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security",
};

export default function SecuritySettingsPage() {
  return (
    <div className="mx-auto max-w-md space-y-8">
      <DisplayHeading as="h1" className="text-3xl">
        Security
      </DisplayHeading>
      <p className="font-body text-sm text-on-surface-variant">
        <Link
          href="/dashboard/settings/profile"
          className="text-primary underline-offset-2 hover:underline"
        >
          Back to profile
        </Link>
      </p>
      <SecurityPasswordForm />
    </div>
  );
}
