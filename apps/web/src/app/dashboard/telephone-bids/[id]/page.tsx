import { TelephoneBidDetailContent } from "@/app/dashboard/telephone-bids/telephone-bid-detail-content";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DashboardTelephoneBidDetailPage({ params }: Props) {
  const { id } = await params;
  const workspaceMeta = await readClientWorkspacePageMeta();
  if (!id) notFound();

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Telephone booking"
      description="Review status, linked lots, and request a limit increase."
    >
      <TelephoneBidDetailContent bookingId={id} />
    </DashboardListPage>
  );
}
