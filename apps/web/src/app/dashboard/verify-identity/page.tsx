import { VerifyIdentityClient } from "@/app/dashboard/verify-identity/verify-identity-client";
import { PageHeader } from "@auction/ui/components/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify identity",
};

export default function VerifyIdentityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        className="mb-6"
        title="Verify your identity"
        description="We use Stripe Identity to confirm who you are when your bidding exposure reaches our threshold."
      />
      <VerifyIdentityClient />
    </div>
  );
}
