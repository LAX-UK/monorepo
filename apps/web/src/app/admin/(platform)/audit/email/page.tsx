import { AppScreen } from "@/components/dashboard/dashboard-page";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

export default function AdminAuditEmailPage() {
  return (
    <AppScreen className="space-y-6">
      <PageHeader
        title="Email audit"
        description="Correlate campaign sends with email_event rows for compliance review."
        className="border-0 pb-0"
      />
      <EmptyState
        title="Use outbox for now"
        description="Transactional sends appear under Email → Outbox until this viewer aggregates provider callbacks."
        action={
          <Link
            href="/admin/email/outbox"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest text-on-primary"
          >
            Open outbox
          </Link>
        }
      />
    </AppScreen>
  );
}
