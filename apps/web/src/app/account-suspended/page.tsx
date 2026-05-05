import { AuthLayout } from "@/components/auth/auth-layout";
import { LogoutButton } from "@/components/layout/logout-button";
import { SuspendedNotice } from "@/components/marketing/suspended-notice";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Account suspended",
  "Your London Art Exchange account is suspended.",
);

export default function AccountSuspendedPage() {
  return (
    <main id="main-content">
      <AuthLayout
        title="Account suspended"
        description="Bidding and some account actions are unavailable until your account is restored."
      >
        <div className="flex w-full flex-col gap-8">
          <SuspendedNotice />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="cta" size="xl" className="font-headline shadow-none">
              <Link href="/contact">Contact support</Link>
            </Button>
            <LogoutButton className="min-h-11 rounded-md border border-outline-variant/30 px-4 py-2 text-center font-label text-xs uppercase tracking-widest text-on-surface hover:bg-surface-container-high" />
          </div>
        </div>
      </AuthLayout>
    </main>
  );
}
