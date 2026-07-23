import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

/** Catalogue fields live on Overview — canonical five-tab IA per verified Figma frames. */
export default async function AdminLotCataloguePage({ params }: Props) {
  const { id } = await params;
  redirect(`/admin/lots/${id}#catalogue`);
}
