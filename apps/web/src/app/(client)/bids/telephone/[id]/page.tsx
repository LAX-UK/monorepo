import { TelephoneBidDetailContent } from "@/app/(client)/bids/telephone/telephone-bid-detail-content";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Telephone booking" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DashboardTelephoneBidDetailPage({ params }: Props) {
  const { id } = await params;
  if (!id) notFound();

  return (
    <DashboardListPage
      title="Telephone booking"
      description="Review status, linked lots, and request a limit increase."
    >
      <TelephoneBidDetailContent bookingId={id} />
    </DashboardListPage>
  );
}
