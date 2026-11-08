import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { PrivateSaleDetail } from "@/components/dashboard/private-sales/private-sale-detail";
import { SetMobileShellTitle } from "@/components/layout/set-mobile-shell-title";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ACCOUNT_LOAD_ERROR } from "@/lib/dashboard/dashboard-copy";
import { loadPartyDeal } from "@/lib/private-sales/party-deals.server";
import { privateSaleHref } from "@/lib/private-sales/party-deals.vm";
import { privateSaleReferenceSchema } from "@auction/validators";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Private sale" };

type PageProps = { params: Promise<{ reference: string }> };

/**
 * One private sale for a person named in it, as their side may see it. A reference that is not
 * theirs answers exactly as one that does not exist.
 */
export default async function PrivateSalePage({ params }: PageProps) {
  const { reference } = await params;
  await requireAuthenticatedUser({ shell: "client", loginNext: privateSaleHref(reference) });
  const parsed = privateSaleReferenceSchema.safeParse(decodeURIComponent(reference));
  if (!parsed.success) notFound();

  const detail = await loadPartyDeal(parsed.data).catch(() => "unavailable" as const);
  if (detail === "unavailable") {
    return (
      <DashboardPage>
        <SetMobileShellTitle title="Private sale" />
        <AccountLoadError {...ACCOUNT_LOAD_ERROR.purchase} headingLevel="h1" />
      </DashboardPage>
    );
  }
  if (!detail) notFound();
  return (
    <DashboardPage>
      <SetMobileShellTitle title={detail.work.title} />
      <PrivateSaleDetail detail={detail} />
    </DashboardPage>
  );
}
