"use client";

import type { AgreementDocumentRow } from "@/lib/organisation-team/agreement-documents.vm";
import { RecordList, RecordRow } from "@auction/ui/components/record-row";
import { Button } from "@auction/ui/lax/button";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { Download, FileText } from "lucide-react";
import Link from "next/link";

/** The organisation's consignment agreements, each with its PDF; one still to accept says so. */
export function AgreementDocuments({ rows }: { rows: readonly AgreementDocumentRow[] }) {
  return (
    <RecordList aria-label="Consignment agreements">
      {rows.map((row) => (
        <RecordRow
          key={row.submissionId}
          {...(row.pageHref ? { href: row.pageHref, linkAs: Link } : {})}
          leading={
            <span
              aria-hidden
              className="grid size-10 place-items-center rounded-lax-badge bg-lax-paper text-lax-muted"
            >
              <FileText className="size-5" strokeWidth={1.5} />
            </span>
          }
          title={row.title}
          meta={[row.detail, "PDF"]}
          status={
            row.accepted ? null : (
              <StatusBadge tone="warning" shape="alert">
                To accept
              </StatusBadge>
            )
          }
          actionBeside
          action={
            <Button asChild variant="ghost" size="icon-md" className="size-lax-control-lg">
              <a href={row.href} download aria-label={`Download ${row.title}`}>
                <Download aria-hidden />
              </a>
            </Button>
          }
        />
      ))}
    </RecordList>
  );
}
