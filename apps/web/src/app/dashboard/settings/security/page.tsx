import { SecurityPasswordForm } from "@/components/auth/security-password-form";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security",
};

export default function SecuritySettingsPage() {
  return (
    <div className="mx-auto max-w-md space-y-8">
      <PageHeader
        title="Security"
        description="Update your password and review account access settings."
        className="border-0 pb-0"
        actions={
          <Link
            href="/dashboard/settings/profile"
            className="font-label text-xs uppercase tracking-widest text-primary underline-offset-2 hover:underline"
          >
            Back to profile
          </Link>
        }
      />
      <SecurityPasswordForm />
    </div>
  );
}
