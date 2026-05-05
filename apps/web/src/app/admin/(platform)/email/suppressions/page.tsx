import {
  type EmailSuppressionRow,
  EmailSuppressionsBoard,
} from "@/components/admin/email-suppressions-board";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { MailX } from "lucide-react";

export default async function AdminEmailSuppressionsPage() {
  const res = await authedServerFetch("/admin/email/suppressions");
  const rows = res.ok ? ((await res.json()) as { data: EmailSuppressionRow[] }).data : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Email suppressions" description="Addresses blocked from outbound email." />
      {rows.length === 0 ? (
        <EmptyState
          icon={<MailX aria-hidden />}
          title="No suppressed addresses"
          description="Bounces, complaints, and unsubscribes will appear here."
        />
      ) : (
        <EmailSuppressionsBoard rows={rows} />
      )}
    </div>
  );
}
