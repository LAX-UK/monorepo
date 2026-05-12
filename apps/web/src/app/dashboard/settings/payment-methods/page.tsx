import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import { PageHeader } from "@auction/ui/components/page-header";
import { CreditCard, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Payment methods" };

/** Buyer-facing payment methods management.
 *
 * The auction-house Stripe integration today saves cards inline during
 * checkout (PaymentIntent.confirm with `setup_future_usage: "off_session"`).
 * Until the dedicated SetupIntents endpoint is wired in, this page provides
 * the canonical entry point users expect (the settings sidebar links here
 * and the dead "Add card" CTA on the profile board now points here too) and
 * documents the workflow.
 */
export default async function PaymentMethodsSettingsPage() {
  await requireAuthenticatedUser({
    shell: "client",
    loginNext: "/dashboard/settings/payment-methods",
  });

  return (
    <DashboardPage className="space-y-8">
      <PageHeader
        title="Payment methods"
        description="Cards used to settle invoices and clear deposits."
        className="border-0 pb-0"
      />

      <Alert className="rounded-xl border-outline-variant/30">
        <AlertTitle>Cards are saved during checkout</AlertTitle>
        <AlertDescription>
          When you complete a payment for the first time, you can opt in to save the card for future
          invoices. We do not store card details on our servers \u2014 Stripe vaults them and we
          only reference a token.
        </AlertDescription>
      </Alert>

      <Card className="border-outline-variant/15 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 font-headline text-base font-semibold tracking-tight">
              <CreditCard className="size-4 text-primary" aria-hidden />
              Saved cards
            </CardTitle>
            <CardDescription>Manage cards on file with the auction house.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-on-surface-variant">
            You have no saved cards yet. The next invoice you pay will give you the option to save
            the card for future use.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard/portfolio">Go to outstanding invoices</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/payments">Payments history</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/15 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline text-base font-semibold tracking-tight">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Security
          </CardTitle>
          <CardDescription>
            Cards are tokenised by Stripe with 3D Secure (SCA) on every transaction over the EU
            threshold. We never see the full PAN.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-on-surface-variant">
          <p>
            To remove a saved card, please contact{" "}
            <a
              href="mailto:support@thelax.co"
              className="text-primary underline-offset-4 hover:underline"
            >
              support@thelax.co
            </a>{" "}
            until self-serve removal ships. Cards used for in-flight payments cannot be deleted
            until those payments clear.
          </p>
        </CardContent>
      </Card>
    </DashboardPage>
  );
}
