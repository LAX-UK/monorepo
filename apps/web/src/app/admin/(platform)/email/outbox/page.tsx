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
import { Mail } from "lucide-react";
import Link from "next/link";

type EmailOutboxRow = {
  id: string;
  userEmail: string | null;
  toEmailHash: string;
  template: string;
  status: "pending" | "sending" | "sent" | "failed" | "suppressed";
  messageId: string | null;
  lastError: string | null;
  createdAt: string;
};

export default async function AdminEmailOutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ? `?status=${encodeURIComponent(sp.status)}` : "";
  const res = await authedServerFetch(`/admin/email/outbox${status}`);
  const rows = res.ok ? ((await res.json()) as { data: EmailOutboxRow[] }).data : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Email outbox" description="Recent transactional email sends." />
      <div className="flex flex-wrap gap-2">
        {["all", "pending", "sent", "failed", "suppressed"].map((item) => (
          <Link
            key={item}
            href={item === "all" ? "/admin/email/outbox" : `/admin/email/outbox?status=${item}`}
            className="min-h-11 rounded-full border border-outline-variant/20 px-4 py-2 font-label text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high"
          >
            {item}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Mail aria-hidden />}
          title="No email rows"
          description="Transactional email sends will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {row.userEmail ? maskEmail(row.userEmail) : shortHash(row.toEmailHash)}
                  </TableCell>
                  <TableCell>{row.template}</TableCell>
                  <TableCell>
                    <StatusBadge variant={statusVariant(row.status)}>{row.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {row.messageId ?? row.lastError ?? "—"}
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
  return `${value.slice(0, 10)}…`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return local && domain ? `${local.slice(0, 1)}***@${domain}` : "masked";
}

function statusVariant(
  status: EmailOutboxRow["status"],
): "success" | "danger" | "warning" | "neutral" {
  if (status === "sent") return "success";
  if (status === "failed" || status === "suppressed") return "danger";
  if (status === "sending") return "warning";
  return "neutral";
}
