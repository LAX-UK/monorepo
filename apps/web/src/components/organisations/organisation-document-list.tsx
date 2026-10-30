import { OrganisationDocumentUpload } from "@/components/organisations/organisation-document-upload";
import { ORGANISATION_DOCUMENT_FORMATS } from "@/lib/organisations/organisation-document-upload-copy";
import type { OrganisationDocumentRowView } from "@/lib/organisations/organisation-documents.vm";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  entityId: string;
  intro: string;
  rows: readonly OrganisationDocumentRowView[];
  closedNote: string | null;
};

/** Every document asked for, one row each: its name, its state and, for senders, the action. */
export function OrganisationDocumentList({ entityId, intro, rows, closedNote }: Props) {
  const anyAction = rows.some((row) => row.action !== null);
  return (
    <Surface variant="section" padding="md" className="space-y-4">
      <p className="font-body text-sm text-on-surface-variant">{intro}</p>
      <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-2">
              <p className="break-words font-body text-sm font-medium text-on-surface">
                {row.title}
              </p>
              <div>
                <StatusBadge tone={row.badge.tone}>{row.badge.label}</StatusBadge>
              </div>
              {row.hint ? (
                <p className="font-body text-sm text-on-surface-variant">{row.hint}</p>
              ) : null}
            </div>
            {row.action ? (
              <div className="shrink-0">
                <OrganisationDocumentUpload
                  entityId={entityId}
                  target={row.action.target}
                  label={row.action.label}
                  documentTitle={row.title}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {anyAction ? (
        <p className="font-body text-xs text-on-surface-variant">{ORGANISATION_DOCUMENT_FORMATS}</p>
      ) : null}
      {closedNote ? (
        <p className="font-body text-sm text-on-surface-variant">{closedNote}</p>
      ) : null}
    </Surface>
  );
}
