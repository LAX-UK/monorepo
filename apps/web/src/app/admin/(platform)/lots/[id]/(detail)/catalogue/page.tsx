import { loadAdminLotCataloguePage } from "@/lib/admin/lots/load-lot-catalogue-page";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Catalogue fields live on Overview — redirects to the overview catalogue anchor. */
export default async function AdminLotCataloguePage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLotCataloguePage(id);
  redirect(page.redirectHref);
}
