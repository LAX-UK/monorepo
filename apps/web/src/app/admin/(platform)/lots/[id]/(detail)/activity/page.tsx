import { LotActivityTabBoard } from "@/components/admin/lot-detail/lot-activity-tab-board";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotActivityPage({ params }: Props) {
  const { id } = await params;
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "lot",
    aggregateId: id,
    limit: 50,
  }).catch(() => []);
  return <LotActivityTabBoard lotId={id} events={events} />;
}
