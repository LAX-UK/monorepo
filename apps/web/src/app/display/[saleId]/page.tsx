import { SaleroomDisplayShell } from "@/features/saleroom/components/display/saleroom-display-shell";

type Props = {
  params: Promise<{ saleId: string }>;
};

export default async function SaleroomDisplayPage({ params }: Props) {
  const { saleId } = await params;
  return <SaleroomDisplayShell saleId={saleId} />;
}
