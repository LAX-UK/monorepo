"use client";

import { AuthoriseBuyerAgentDialog } from "@/components/admin/legal-entities/buyer-agents/authorise-buyer-agent-dialog";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { adminRevokeBuyerAgentAuthorisationAction } from "@/lib/admin/legal-entities/buyer-agent-authorisation.actions";
import {
  authorisationState,
  authorisationStatePresentation,
  formatPounds,
  revokeConsequence,
  summariseAuthorisation,
} from "@/lib/buyer-agents/authorisation-presenter";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  type DataColumn,
  Notice,
  type OverflowAction,
  PersonCell,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatusBadge,
  rowActionsColumn,
} from "@auction/staff-ui";
import type { BuyerAgentAuthorisationOverview, BuyerAgentAuthorisationView } from "@auction/types";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  entityId: string;
  entityName: string;
  overview: BuyerAgentAuthorisationOverview | null;
  /** Staff with legal entity write access. */
  canManage: boolean;
};

const STATE_ORDER = { active: 0, scheduled: 1, expired: 2, revoked: 3 } as const;

/**
 * Which of the organisation's buyer agents may bid for it, for which sales, up to what limit and
 * until when; staff with write access authorise and revoke here, the same as the organisation's
 * owners and admins do from their Members page.
 */
export function LegalEntityBuyerAgentsTab({ entityId, entityName, overview, canManage }: Props) {
  const router = useRouter();
  const [authorising, setAuthorising] = useState(false);
  const [revoking, setRevoking] = useState<BuyerAgentAuthorisationView | null>(null);
  const [busy, startTransition] = useTransition();

  const columns = useMemo<DataColumn<BuyerAgentAuthorisationView>[]>(
    () => [
      {
        id: "agent",
        header: "Buyer agent",
        mobile: "title",
        sortable: true,
        sortValue: (a) => a.userName.toLowerCase(),
        cell: (a) => (
          <PersonCell
            name={a.userName}
            secondary={a.userEmail}
            href={`/admin/clients/${encodeURIComponent(a.userId)}`}
            Link={NextLink}
          />
        ),
      },
      {
        id: "scope",
        header: "Sales",
        mobile: "meta",
        cell: (a) => summariseAuthorisation(a).scope,
      },
      {
        id: "limit",
        header: "Limit",
        width: "128px",
        numeric: true,
        mobile: "meta",
        sortable: true,
        sortValue: (a) => (a.bidLimit ? Number.parseFloat(a.bidLimit) : Number.POSITIVE_INFINITY),
        cell: (a) => (a.bidLimit ? formatPounds(a.bidLimit) : "No limit"),
      },
      {
        id: "window",
        header: "Dates",
        width: "220px",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (a) =>
          a.status === "revoked" && a.revokedAt ? (
            <span className="flex flex-col">
              <span>
                Revoked <StaffDate value={a.revokedAt} />
              </span>
              {a.revokedReason ? (
                <span className="text-staff-xs text-staff-muted">{a.revokedReason}</span>
              ) : null}
            </span>
          ) : (
            summariseAuthorisation(a).window
          ),
      },
      {
        id: "status",
        header: "Status",
        width: "128px",
        mobile: "badge",
        truncate: false,
        sortable: true,
        sortValue: (a) => STATE_ORDER[authorisationState(a)],
        cell: (a) => {
          const state = authorisationStatePresentation(a);
          return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>;
        },
      },
      rowActionsColumn<BuyerAgentAuthorisationView>({
        label: (a) => `Actions for ${a.userName}'s authorisation`,
        Link: NextLink,
        actions: (a): OverflowAction[] =>
          a.status === "active"
            ? [
                {
                  id: "revoke",
                  label: "Revoke",
                  tone: "danger",
                  onSelect: () => setRevoking(a),
                  ...(canManage ? {} : { disabledReason: "Needs legal entity write access" }),
                },
              ]
            : [],
      }),
    ],
    [canManage],
  );

  if (!overview) {
    return (
      <Notice tone="danger" title="Buyer agents could not be loaded">
        Refresh the page to try again.
      </Notice>
    );
  }

  const noAgents = overview.buyerAgents.length === 0;
  const authoriseReason = !canManage
    ? "Needs legal entity write access"
    : noAgents
      ? "Nobody here has the buyer agent role yet"
      : null;

  return (
    <>
      <RelatedRecordsSection
        id="buyer-agents"
        title="Buyer agents"
        description={`Owners and admins can always bid for ${entityName}. Buyer agents need an authorisation from them or from LAX.`}
        action={
          <StaffButton
            size="sm"
            variant="secondary"
            icon={<ShieldCheck aria-hidden />}
            onClick={() => setAuthorising(true)}
            {...(authoriseReason ? { disabledReason: authoriseReason } : {})}
          >
            Authorise buyer agent
          </StaffButton>
        }
        label="Buyer agent authorisations"
        columns={columns}
        data={overview.authorisations}
        getRowId={(a) => a.id}
        defaultSort={{ columnId: "status", direction: "asc" }}
        density="comfortable"
        empty={{
          title: noAgents ? "No buyer agents" : "No authorisations yet",
          description: noAgents
            ? "Members with the buyer agent role appear here once they join the organisation."
            : "Authorised buyer agents and their limits appear here.",
        }}
      />
      <AuthoriseBuyerAgentDialog
        legalEntityId={entityId}
        entityName={entityName}
        buyerAgents={overview.buyerAgents}
        sales={overview.sales}
        open={authorising}
        onOpenChange={setAuthorising}
      />
      {revoking ? (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setRevoking(null);
          }}
          title={`Revoke ${revoking.userName}'s authorisation?`}
          description={revokeConsequence(revoking, entityName)}
          confirmLabel="Revoke authorisation"
          tone="danger"
          loading={busy}
          reason={{
            label: "Reason",
            description: "Kept with the authorisation and in the audit log.",
            minLength: 3,
            maxLength: 500,
            missingMessage: "Give a short reason.",
          }}
          onConfirm={({ reason }) => {
            const target = revoking;
            startTransition(async () => {
              const result = await adminRevokeBuyerAgentAuthorisationAction(
                entityId,
                target.id,
                reason,
              );
              if (!result.ok) {
                notify.error("Could not revoke", { description: result.error });
                return;
              }
              notify.success(`${target.userName} can no longer bid for ${entityName}`);
              setRevoking(null);
              router.refresh();
            });
          }}
        />
      ) : null}
    </>
  );
}
