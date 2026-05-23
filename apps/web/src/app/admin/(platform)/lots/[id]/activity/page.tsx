import { LotActivityTab } from "@/components/admin/lot-detail/tabs/activity-tab";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLotActivityPage({ params }: Props) {
  const { id } = await params;
  return <LotActivityTab lotId={id} />;
}
