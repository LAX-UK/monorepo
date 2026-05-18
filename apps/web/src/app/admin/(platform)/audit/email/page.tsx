import { AdminPanelPage } from "@/components/admin/admin-panel-page";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";

export default function AdminAuditEmailPage() {
  return (
    <AdminPanelPage
      title="Email audit"
      description="Correlate campaign sends with email_event rows for compliance review."
    >
      <EmptyState
        title="Use outbox for now"
        description="Transactional sends appear under Email → Outbox until this viewer aggregates provider callbacks."
        action={
          <Link
            href="/admin/email/outbox"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
          >
            Open outbox
          </Link>
        }
      />
    </AdminPanelPage>
  );
}
