import { VerifyIdentityClient } from "@/app/dashboard/verify-identity/verify-identity-client";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify identity",
};

export default function VerifyIdentityPage() {
  return (
    <DashboardPage className="mx-auto max-w-3xl py-8">
      <PageHeader
        className="mb-2 border-0 pb-0"
        title="Verify your identity"
        description="We use Stripe Identity to confirm who you are when your bidding exposure reaches our threshold."
      />
      <VerifyIdentityClient />
    </DashboardPage>
  );
}
