"use client";

import type { StatementDocumentRow } from "@/lib/organisation-team/statement-documents.vm";
import { RecordList, RecordRow } from "@auction/ui/components/record-row";
import { Button } from "@auction/ui/lax/button";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { Download, Wallet } from "lucide-react";
import Link from "next/link";

/** The organisation's payout statements, each with its PDF. */
export function StatementDocuments({ rows }: { rows: readonly StatementDocumentRow[] }) {
  return (
    <RecordList aria-label="Payout statements">
      {rows.map((row) => (
        <RecordRow
          key={row.payoutId}
          {...(row.pageHref ? { href: row.pageHref, linkAs: Link } : {})}
          leading={
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-lax-badge bg-lax-paper text-lax-muted"
            >
              <Wallet className="size-5" strokeWidth={1.5} />
            </span>
          }
          title={row.title}
          meta={[row.period, row.detail]}
          status={
            row.unavailable ? (
              <StatusBadge tone="neutral" shape="ring">
                Contact us for a copy
              </StatusBadge>
            ) : null
          }
          actionBeside
          action={
            row.unavailable ? null : (
              <Button asChild variant="ghost" size="icon-md" className="size-lax-control-lg">
                <a href={row.href} download aria-label={`Download ${row.title}, ${row.period}`}>
                  <Download aria-hidden />
                </a>
              </Button>
            )
          }
        />
      ))}
    </RecordList>
  );
}
