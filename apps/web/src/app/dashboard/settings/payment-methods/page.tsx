import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { SettingsFormHeader } from "@/components/dashboard/settings-form-header";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { DASHBOARD_CTA, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { ListRow } from "@auction/ui/components/list-row";
import { Surface } from "@auction/ui/components/surface";
import { CreditCard, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Payment methods" };

export default async function PaymentMethodsSettingsPage() {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/payment-methods",
  });

  return (
    <DashboardPage className="space-y-8">
      <SettingsFormHeader title="Payment methods" />

      <Alert className="rounded-xl border-border-hairline">
        <AlertTitle>Cards are saved during checkout</AlertTitle>
        <AlertDescription>
          When you complete a payment for the first time, you can opt in to save the card for future
          invoices. We do not store card details on our servers — Stripe vaults them and we only
          reference a token.
        </AlertDescription>
      </Alert>

      <Surface variant="section" padding="md" className="space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" aria-hidden />
          <p className="font-headline text-base font-semibold tracking-tight text-on-surface">
            Saved cards
          </p>
        </div>
        <p className="font-body text-sm text-on-surface-variant">
          You have no saved cards yet. The next invoice you pay will give you the option to save the
          card for future use.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/portfolio">Go to outstanding invoices</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={DASHBOARD_ROUTES.payments}>{DASHBOARD_CTA.myPayments}</Link>
          </Button>
        </div>
        <ListRow
          title="Self-serve card management"
          subtitle="Coming soon — contact support to remove a saved card today."
          value="Soon"
          disabled
        />
      </Surface>

      <Surface variant="quiet" padding="md" className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          <p className="font-headline text-base font-semibold text-on-surface">Security</p>
        </div>
        <p className="font-body text-sm text-on-surface-variant">
          Cards are tokenised by Stripe with 3D Secure (SCA) on every transaction over the EU
          threshold. We never see the full PAN. To remove a saved card, contact{" "}
          <a
            href={`mailto:${SITE_SUPPORT_EMAIL}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {SITE_SUPPORT_EMAIL}
          </a>{" "}
          until self-serve removal ships.
        </p>
      </Surface>
    </DashboardPage>
  );
}
