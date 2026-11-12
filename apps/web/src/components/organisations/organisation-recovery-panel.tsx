import { hopUrl } from "@/lib/navigation/hop-href";
import type {
  OrganisationRecoveryView,
  RecoveryDocumentRow,
} from "@/lib/organisations/organisation-recovery.vm";
import { RecordList, RecordRow } from "@auction/ui/components/record-row";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { ButtonLink } from "@auction/ui/lax/button-link";
import Link from "next/link";
import { useId } from "react";
import { AccountSwitchLink } from "./account-switch-link";

const ROW_BUTTON = "h-11 sm:h-lax-control-md";

function documentRow(row: RecoveryDocumentRow) {
  return (
    <RecordRow
      key={row.key}
      title={row.title}
      status={<StatusBadge tone={row.badge.tone}>{row.badge.label}</StatusBadge>}
      detail={row.hint ? <p className="text-lax-14 text-lax-muted">{row.hint}</p> : null}
      action={
        row.link ? (
          <ButtonLink
            size="sm"
            variant="secondary"
            className={ROW_BUTTON}
            href={row.link.href}
            Link={Link}
            aria-label={`${row.link.label}, ${row.title}`}
          >
            {row.link.label}
          </ButtonLink>
        ) : null
      }
    />
  );
}

/**
 * What a held organisation still allows, below its banner: which things are open and which are
 * paused (each with a word, never colour alone), the documents asked for with where each one is,
 * and how far the check has got. Rows are the kit's record rows; words and rows come from the
 * recovery view and nothing is decided here.
 */
export function OrganisationRecoveryPanel({
  view,
  showPersonal = false,
}: {
  view: OrganisationRecoveryView;
  /** Set when no banner above carries the button that keeps the person bidding as themselves. */
  showPersonal?: boolean;
}) {
  const abilitiesId = useId();
  const documentsId = useId();
  return (
    <Surface
      variant="section"
      padding="md"
      className="space-y-6"
      data-testid="organisation-recovery"
      data-kind={view.kind}
    >
      <section aria-labelledby={abilitiesId} className="space-y-3">
        <h2 id={abilitiesId} className="font-lax-display text-lax-18 font-semibold text-lax-fg">
          {view.heading}
        </h2>
        <RecordList>
          {view.abilities.map((ability) => (
            <RecordRow
              key={ability.key}
              title={ability.label}
              status={<StatusBadge tone={ability.tag.tone}>{ability.tag.label}</StatusBadge>}
            />
          ))}
        </RecordList>
      </section>
      {view.documents ? (
        <section aria-labelledby={documentsId} className="space-y-3">
          <h3 id={documentsId} className="font-lax-display text-lax-16 font-semibold text-lax-fg">
            {view.documents.heading}
          </h3>
          <RecordList>{view.documents.rows.map(documentRow)}</RecordList>
        </section>
      ) : null}
      {showPersonal && view.personal ? (
        <ButtonLink
          size="sm"
          variant="secondary"
          className={`${ROW_BUTTON} w-full sm:w-auto`}
          href={hopUrl(view.personal.href)}
          Link={AccountSwitchLink}
        >
          {view.personal.label}
        </ButtonLink>
      ) : null}
      {view.progress ? (
        <p className="text-lax-14 text-lax-muted">
          {view.progress.line}{" "}
          {view.progress.contact ? (
            <a
              className="inline-flex min-h-11 items-center font-medium text-lax-fg underline underline-offset-4 sm:min-h-0"
              href={view.progress.contact.href}
            >
              {view.progress.contact.label}
            </a>
          ) : null}
        </p>
      ) : null}
    </Surface>
  );
}
