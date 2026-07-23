import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Legacy route — activity lives on Overview. */
export default async function AdminSaleActivityRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/sales/${id}#activity`);
}
