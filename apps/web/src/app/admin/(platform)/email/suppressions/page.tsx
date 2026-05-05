import { EmailSuppressionRemoveButton } from "@/components/admin/email-suppression-remove-button";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@auction/ui/components/table";
import { MailX } from "lucide-react";

type SuppressionRow = {
  emailHash: string;
  reason: "hard_bounce" | "complaint" | "manual" | "unsubscribe";
  createdAt: string;
};

export default async function AdminEmailSuppressionsPage() {
  const res = await authedServerFetch("/admin/email/suppressions");
  const rows = res.ok ? ((await res.json()) as { data: SuppressionRow[] }).data : [];

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
        <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email hash</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.emailHash}>
                  <TableCell>{shortHash(row.emailHash)}</TableCell>
                  <TableCell>
                    <StatusBadge variant={row.reason === "complaint" ? "danger" : "warning"}>
                      {row.reason}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <EmailSuppressionRemoveButton emailHash={row.emailHash} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function shortHash(value: string): string {
  return `${value.slice(0, 14)}…`;
}
