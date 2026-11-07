import { supportMailto } from "@/lib/dashboard/dashboard-copy";
import { accountHomePathForKind } from "@/lib/navigation/account-home";
import { organisationHref, withAccount } from "@/lib/navigation/client-routes";
import { type HopHref, hopHref } from "@/lib/navigation/hop-href";
import {
  type OrganisationDocumentRowView,
  type OrganisationDocumentsView,
  longDateOrNull,
} from "@/lib/organisations/organisation-documents.vm";
import type { OrganisationDocumentStateView } from "@/lib/presenters/organisation-document-state";
import {
  ABILITY_LABEL,
  CLOSED_TAG,
  DOCUMENTS_HEADING,
  KEEP_BIDDING_LABEL,
  OPEN_TAG,
  RECOVERY_HEADING,
  REVIEW_TAKING_LONG,
  type RecoveryTag,
  documentsReceivedLine,
} from "@/lib/presenters/organisation-state/organisation-recovery-copy";
import {
  type OrganisationAbilityKey,
  type OrganisationDocumentState,
  type OrganisationRecoveryKind,
  organisationAbilities,
  organisationRecoveryKind,
  organisationReviewOverdue,
} from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";

export type RecoveryAbilityRow = {
  key: OrganisationAbilityKey;
  label: string;
  open: boolean;
  tag: RecoveryTag;
};

export type RecoveryDocumentRow = {
  key: string;
  title: string;
  badge: OrganisationDocumentStateView;
  hint: string | null;
  /** To the Documents tab, offered only to people who send documents. */
  link: { label: string; href: string } | null;
};

export type OrganisationRecoveryView = {
  kind: OrganisationRecoveryKind;
  heading: string;
  abilities: RecoveryAbilityRow[];
  documents: { heading: string; rows: RecoveryDocumentRow[] } | null;
  /** Where the check is, with a way to ask when it takes long. */
  progress: { line: string; contact: { label: string; href: string } | null } | null;
  /** Keeps the person buying as themselves; `null` without a personal account to switch to. */
  personal: { label: string; href: HopHref } | null;
};

export type OrganisationRecoveryInput = {
  status: LegalEntityStatus;
  /** The Documents tab's view, when the state is about documents; `null` otherwise. */
  documents: OrganisationDocumentsView | null;
  /** When the latest document was sent, or `null` when none carries a date. */
  documentsReceivedAt: Date | null;
  /** The moment the screen is built for, to tell whether the check is taking long. */
  now: Date;
  /** The person's own account, or `null` when they have none to switch to. */
  personalAccountId: string | null;
  /** The personal account can bid now: its identity check is clear. */
  personalCanBid: boolean;
  /** Support staff viewing as the client cannot change the account in use. */
  impersonating: boolean;
};

/** Only a document that still needs sending links on to the Documents tab. */
const NEEDS_SENDING: ReadonlySet<OrganisationDocumentState> = new Set([
  "requested",
  "needs_replacing",
]);

function documentRow(row: OrganisationDocumentRowView): RecoveryDocumentRow {
  const send = row.action !== null && NEEDS_SENDING.has(row.state);
  return {
    key: row.key,
    title: row.title,
    badge: row.badge,
    hint: row.hint,
    link: send
      ? { label: row.action?.label ?? "Upload", href: organisationHref("documents") }
      : null,
  };
}

function progressFor(
  status: LegalEntityStatus,
  receivedAt: Date | null,
  now: Date,
): OrganisationRecoveryView["progress"] {
  if (status !== "docs_received" && status !== "under_review") return null;
  const date = longDateOrNull(receivedAt);
  if (!date || !receivedAt) return null;
  const line = documentsReceivedLine(date);
  // Contact us appears only once the check has run past the time we promise.
  if (!organisationReviewOverdue(receivedAt, now)) return { line, contact: null };
  return {
    line: `${line} ${REVIEW_TAKING_LONG}`,
    contact: { label: "Contact us", href: supportMailto("Organisation under review") },
  };
}

/**
 * What a held organisation shows beneath its banner: what is still open and what is paused (from
 * the one state policy), the documents asked for while they are the way forward, where the check
 * has got to, and the way to keep buying as the person themselves once they can bid. `null` for a state that
 * needs no recovery (approved, setting up payouts, closed).
 */
export function buildOrganisationRecoveryView(
  input: OrganisationRecoveryInput,
): OrganisationRecoveryView | null {
  const kind = organisationRecoveryKind(input.status);
  if (!kind) return null;
  const documents =
    input.documents && input.documents.rows.length > 0
      ? { heading: DOCUMENTS_HEADING, rows: input.documents.rows.map(documentRow) }
      : null;
  return {
    kind,
    heading: RECOVERY_HEADING,
    abilities: organisationAbilities(input.status).map(({ key, open }) => ({
      key,
      label: ABILITY_LABEL[key],
      open,
      tag: open ? OPEN_TAG : CLOSED_TAG[kind],
    })),
    documents,
    progress: progressFor(input.status, input.documentsReceivedAt, input.now),
    personal:
      input.personalAccountId && input.personalCanBid && !input.impersonating
        ? {
            label: KEEP_BIDDING_LABEL,
            href: hopHref(withAccount(accountHomePathForKind("personal"), input.personalAccountId)),
          }
        : null,
  };
}

/** Whether a state's recovery shows the documents asked for (the others never do). */
export function recoveryShowsDocuments(status: LegalEntityStatus): boolean {
  const kind = organisationRecoveryKind(status);
  return kind === "documents_requested" || kind === "documents_under_review";
}

/**
 * The recovery on the page at `currentPath`: the Documents tab lists the same documents in full,
 * so there the checklist is left out.
 */
export function organisationRecoveryForPage(
  view: OrganisationRecoveryView,
  currentPath: string,
): OrganisationRecoveryView {
  return currentPath === organisationHref("documents") ? { ...view, documents: null } : view;
}
