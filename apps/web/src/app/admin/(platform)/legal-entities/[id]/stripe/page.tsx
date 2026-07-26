import { LegalEntityStripeTab } from "@/components/admin/legal-entities/tabs/stripe-tab";
import { loadAdminLegalEntityStripePage } from "@/lib/admin/legal-entities/load-legal-entity-stripe-page";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminLegalEntityStripePage({ params }: Props) {
  const { id } = await params;
  const page = await loadAdminLegalEntityStripePage(id);
  return <LegalEntityStripeTab entity={page.entity} />;
}
