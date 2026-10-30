"use client";

import { AuthoriseBuyerAgentDialog } from "@/components/legal-entity/buyer-agents/authorise-buyer-agent-dialog";
import { RevokeAuthorisationDialog } from "@/components/legal-entity/buyer-agents/revoke-authorisation-dialog";
import { MemberInitials } from "@/components/legal-entity/members/member-initials";
import { initials } from "@/components/organisations/initials";
import type {
  AuthorisationRowView,
  UsageView,
  WhoCanBidView,
} from "@/lib/organisation-team/who-can-bid.vm";
import type {
  AuthorisableBuyerAgent,
  AuthorisableSale,
  BuyerAgentAuthorisationView,
} from "@auction/types";
import { RecordList, RecordRow } from "@auction/ui";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Meter,
  StatusBadge,
} from "@auction/ui/lax";
import { Ellipsis, Plus, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { OrganisationLimitDialog } from "./organisation-limit-dialog";
import { TeamListEmpty } from "./team-list-states";

type Props = {
  legalEntityId: string;
  organisationName: string;
  view: WhoCanBidView;
  sales: AuthorisableSale[];
};

const SECTION_HEADING = "font-lax-display text-lax-18 font-semibold text-lax-fg";

function Usage({
  usage,
  label,
  showLeft = true,
}: { usage: UsageView; label: string; showLeft?: boolean }) {
  return (
    <span className="flex w-full flex-col gap-1.5 @2xl:w-44">
      <span className="flex items-baseline justify-between gap-2 text-lax-13 tabular-nums">
        <span
          className={
            usage.idle && usage.percent === null ? "text-lax-muted" : "font-medium text-lax-fg"
          }
        >
          {usage.text}
        </span>
        {showLeft && usage.left ? <span className="text-lax-muted">{usage.left}</span> : null}
      </span>
      {usage.percent !== null ? (
        <Meter value={usage.percent} label={`${label}: ${usage.text} used`} />
      ) : null}
    </span>
  );
}

/** The organisation-wide limit: what it is, what is committed under it, and Set or Change. */
function OrganisationLimitCard({
  view,
  organisationName,
  onChange,
}: {
  view: NonNullable<WhoCanBidView["organisation"]>;
  organisationName: string;
  onChange: () => void;
}) {
  return (
    <section
      aria-labelledby="org-limit-heading"
      className="flex flex-col gap-4 rounded-lax-card border border-lax-line bg-lax-surface p-4 md:flex-row md:items-center md:gap-6 md:p-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="org-limit-heading" className="text-lax-14 font-semibold text-lax-fg">
          {view.limit
            ? `${organisationName}'s limit: ${view.limit}`
            : `${organisationName} has no bidding limit`}
        </h2>
        <p className="text-lax-13 text-lax-muted">
          {view.limit
            ? "Everyone bidding for it shares this limit, owners and admins included. Buyer agents also keep to their own limits below. The lowest limit always applies."
            : "Owners and admins bid without a limit. Buyer agents bid only in the sales and up to the limits below."}
        </p>
      </div>
      <div className="flex flex-col gap-3 md:w-56 md:shrink-0">
        <Usage usage={view.usage} label={`${organisationName}'s limit`} />
      </div>
      {view.canManage ? (
        <Button onClick={onChange} className="md:shrink-0">
          {view.limit ? "Change limit" : "Set a limit"}
        </Button>
      ) : null}
    </section>
  );
}

function AuthorisationRow({
  row,
  canManage,
  onChange,
  onRevoke,
}: {
  row: AuthorisationRowView;
  canManage: boolean;
  onChange: () => void;
  onRevoke: () => void;
}) {
  return (
    <RecordRow
      leading={<MemberInitials>{initials(row.agent.name)}</MemberInitials>}
      title={row.title}
      meta={row.facts}
      status={
        <StatusBadge
          tone={row.badge.tone}
          {...(row.badge.tone === "warning" ? { shape: "alert" } : {})}
        >
          {row.badge.label}
        </StatusBadge>
      }
      value={
        row.usage ? <Usage usage={row.usage} label={`${row.title} total`} showLeft={false} /> : null
      }
      menu={
        canManage ? (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-md" aria-label={`More for ${row.title}`}>
                <Ellipsis aria-hidden />
              </Button>
            </MenuTrigger>
            <MenuContent className="w-56">
              <MenuItem onSelect={onChange}>
                <SlidersHorizontal aria-hidden />
                Change limits…
              </MenuItem>
              <MenuSeparator />
              <MenuItem tone="danger" onSelect={onRevoke}>
                <X aria-hidden />
                End this authorisation…
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : (
          <span aria-hidden className="block size-lax-control-md" />
        )
      }
    />
  );
}

/**
 * Who can bid for the organisation: its own limit, then each buyer agent's authorisations (where,
 * until when, how much a lot, and how much of their total is in use), and the agents who aren't
 * authorised yet. Owners and admins authorise, change limits and end authorisations here.
 */
export function WhoCanBid({ legalEntityId, organisationName, view, sales }: Props) {
  const [limitOpen, setLimitOpen] = useState(false);
  const [authorising, setAuthorising] = useState<{
    agent: AuthorisableBuyerAgent;
    current?: BuyerAgentAuthorisationView;
  } | null>(null);
  const [revoking, setRevoking] = useState<BuyerAgentAuthorisationView | null>(null);
  const agents = [
    ...new Map(
      [...view.rows.map((row) => row.agent), ...view.unauthorised].map((a) => [a.userId, a]),
    ).values(),
  ];
  const open = (fn: () => void) => window.setTimeout(fn, 0);

  return (
    <div className="flex flex-col gap-8">
      {view.organisation ? (
        <OrganisationLimitCard
          view={view.organisation}
          organisationName={organisationName}
          onChange={() => setLimitOpen(true)}
        />
      ) : null}

      <section aria-labelledby="buyer-agents-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="buyer-agents-heading" className={SECTION_HEADING}>
            Buyer agents
          </h2>
          {view.rows.length > 0 ? (
            <span className="text-lax-13 text-lax-muted">
              {view.rows.length === 1 ? "1 authorisation" : `${view.rows.length} authorisations`}
            </span>
          ) : null}
          {view.canManage && agents.length > 0 ? (
            <span className="max-md:w-full md:ml-auto">
              {agents.length === 1 ? (
                <Button
                  onClick={() => setAuthorising(agents[0] ? { agent: agents[0] } : null)}
                  className="max-md:w-full"
                >
                  <Plus aria-hidden />
                  Authorise a buyer agent
                </Button>
              ) : (
                <Menu>
                  <MenuTrigger asChild>
                    <Button className="max-md:w-full">
                      <Plus aria-hidden />
                      Authorise a buyer agent
                    </Button>
                  </MenuTrigger>
                  <MenuContent className="w-64">
                    {agents.map((agent) => (
                      <MenuItem
                        key={agent.userId}
                        onSelect={() => open(() => setAuthorising({ agent }))}
                      >
                        {agent.name}
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              )}
            </span>
          ) : null}
        </div>

        {agents.length === 0 ? (
          <TeamListEmpty
            illustration="gavel"
            title="No buyer agents yet"
            description={`Invite someone as a buyer agent to bid for ${organisationName} within limits you set. Owners and admins already bid.`}
          />
        ) : (
          <RecordList aria-labelledby="buyer-agents-heading">
            {view.rows.map((row) => (
              <AuthorisationRow
                key={row.id}
                row={row}
                canManage={view.canManage}
                onChange={() =>
                  open(() => setAuthorising({ agent: row.agent, current: row.authorisation }))
                }
                onRevoke={() => open(() => setRevoking(row.authorisation))}
              />
            ))}
            {view.unauthorised.map((agent) => (
              <RecordRow
                key={agent.userId}
                leading={<MemberInitials>{initials(agent.name)}</MemberInitials>}
                title={agent.name}
                meta={[`Not authorised yet, so can't bid for ${organisationName}`]}
                action={
                  view.canManage ? (
                    <Button size="sm" onClick={() => setAuthorising({ agent })}>
                      <UserPlus aria-hidden />
                      Authorise
                    </Button>
                  ) : null
                }
                menu={<span aria-hidden className="block size-lax-control-md" />}
              />
            ))}
          </RecordList>
        )}
      </section>

      {limitOpen && view.organisation ? (
        <OrganisationLimitDialog
          legalEntityId={legalEntityId}
          organisationName={organisationName}
          current={view.organisation.limitPounds}
          onClose={() => setLimitOpen(false)}
        />
      ) : null}
      {authorising ? (
        <AuthoriseBuyerAgentDialog
          legalEntityId={legalEntityId}
          entityName={organisationName}
          agent={authorising.agent}
          {...(authorising.current ? { current: authorising.current } : {})}
          sales={sales}
          open
          onOpenChange={(next) => {
            if (!next) setAuthorising(null);
          }}
        />
      ) : null}
      {revoking ? (
        <RevokeAuthorisationDialog
          legalEntityId={legalEntityId}
          entityName={organisationName}
          authorisation={revoking}
          onClose={() => setRevoking(null)}
        />
      ) : null}
    </div>
  );
}
