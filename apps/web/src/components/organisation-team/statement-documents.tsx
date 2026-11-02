"use client";

import type { StatementDocumentRow } from "@/lib/organisation-team/statement-documents.vm";
import { RecordList, RecordRow } from "@auction/ui";
import { Button, StatusBadge } from "@auction/ui/lax";
import { Download, Wallet } from "lucide-react";

/** The organisation's payout statements, each with its PDF. */
export function StatementDocuments({ rows }: { rows: readonly StatementDocumentRow[] }) {
  return (
    <RecordList aria-label="Payout statements">
      {rows.map((row) => (
        <RecordRow
          key={row.payoutId}
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
          action={
            row.unavailable ? null : (
              <Button asChild variant="ghost" size="icon-md">
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
