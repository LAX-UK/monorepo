"use client";

import type { AgreementDocumentRow } from "@/lib/organisation-team/agreement-documents.vm";
import { RecordList, RecordRow } from "@auction/ui";
import { Button, StatusBadge } from "@auction/ui/lax";
import { Download, FileText } from "lucide-react";

/** The organisation's consignment agreements, each with its PDF; one still to accept says so. */
export function AgreementDocuments({ rows }: { rows: readonly AgreementDocumentRow[] }) {
  return (
    <RecordList aria-label="Consignment agreements">
      {rows.map((row) => (
        <RecordRow
          key={row.submissionId}
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
          action={
            <Button asChild variant="ghost" size="icon-md">
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
