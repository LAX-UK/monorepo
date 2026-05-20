import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Registrations now live on the sale detail Registrations tab. */
export default async function SaleRegistrationsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams({ tab: "registrations" });
  if (sp.error) qs.set("error", sp.error);
  redirect(`/admin/sales/${id}?${qs.toString()}`);
}
