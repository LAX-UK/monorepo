import { hopUrl } from "@/lib/navigation/hop-href";
import type {
  OrganisationRecoveryView,
  RecoveryDocumentRow,
} from "@/lib/organisations/organisation-recovery.vm";
import { Surface } from "@auction/ui/components/surface";
import { ButtonLink, StatusBadge } from "@auction/ui/lax";
import Link from "next/link";
import { AccountSwitchLink } from "./account-switch-link";

function AbilityRows({ abilities }: Pick<OrganisationRecoveryView, "abilities">) {
  return (
    <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
      {abilities.map((ability) => (
        <li
          key={ability.key}
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <span className="font-body text-sm text-on-surface">{ability.label}</span>
          <StatusBadge tone={ability.tag.tone}>{ability.tag.label}</StatusBadge>
        </li>
      ))}
    </ul>
  );
}

function DocumentRow({ row }: { row: RecoveryDocumentRow }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="break-words font-body text-sm font-medium text-on-surface">{row.title}</p>
        <div>
          <StatusBadge tone={row.badge.tone}>{row.badge.label}</StatusBadge>
        </div>
        {row.hint ? <p className="font-body text-sm text-on-surface-variant">{row.hint}</p> : null}
      </div>
      {row.link ? (
        <ButtonLink
          size="sm"
          variant="secondary"
          className="h-11 shrink-0 sm:h-lax-control-md"
          href={row.link.href}
          Link={Link}
          aria-label={`${row.link.label}, ${row.title}`}
        >
          {row.link.label}
        </ButtonLink>
      ) : null}
    </li>
  );
}

/**
 * What a held organisation still allows, below its banner: which things are open and which are
 * paused (each with a word, never colour alone), the documents asked for with where each one is,
 * and how far the check has got. Words and rows come from the recovery view; nothing is decided
 * here.
 */
export function OrganisationRecoveryPanel({
  view,
  showPersonal = false,
}: {
  view: OrganisationRecoveryView;
  /** Set when no banner above carries the button that keeps the person bidding as themselves. */
  showPersonal?: boolean;
}) {
  return (
    <Surface
      variant="section"
      padding="md"
      className="space-y-5"
      data-testid="organisation-recovery"
      data-kind={view.kind}
    >
      <section aria-labelledby="recovery-abilities" className="space-y-3">
        <h2
          id="recovery-abilities"
          className="font-lax-display text-lax-18 font-semibold text-lax-fg"
        >
          {view.heading}
        </h2>
        <AbilityRows abilities={view.abilities} />
      </section>
      {view.documents ? (
        <section aria-labelledby="recovery-documents" className="space-y-3">
          <h3
            id="recovery-documents"
            className="font-lax-display text-lax-16 font-semibold text-lax-fg"
          >
            {view.documents.heading}
          </h3>
          <ul className="divide-y divide-border-hairline rounded-lg border border-border-hairline">
            {view.documents.rows.map((row) => (
              <DocumentRow key={row.key} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
      {showPersonal && view.personal ? (
        <ButtonLink
          size="sm"
          variant="secondary"
          className="h-11 w-full sm:h-lax-control-md sm:w-auto"
          href={hopUrl(view.personal.href)}
          Link={AccountSwitchLink}
        >
          {view.personal.label}
        </ButtonLink>
      ) : null}
      {view.progress ? (
        <p className="font-body text-sm text-on-surface-variant">
          {view.progress.line}{" "}
          {view.progress.contact ? (
            <a
              className="inline-flex min-h-11 items-center font-medium text-on-surface underline underline-offset-4 sm:min-h-0"
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
