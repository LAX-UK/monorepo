"use client";

import {
  authorisationStatePresentation,
  liveAuthorisationsFor,
  summariseAuthorisation,
} from "@/lib/buyer-agents/authorisation-presenter";
import type {
  AuthorisableBuyerAgent,
  BuyerAgentAuthorisationOverview,
  BuyerAgentAuthorisationView,
} from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { EmptyState } from "@auction/ui/components/empty-state";
import { Surface } from "@auction/ui/components/surface";
import { useState } from "react";
import { AuthoriseBuyerAgentDialog } from "./authorise-buyer-agent-dialog";
import { RevokeAuthorisationDialog } from "./revoke-authorisation-dialog";

type Props = {
  legalEntityId: string;
  entityName: string;
  overview: BuyerAgentAuthorisationOverview;
};

function AuthorisationLine({
  authorisation,
  canManage,
  onRevoke,
}: {
  authorisation: BuyerAgentAuthorisationView;
  canManage: boolean;
  onRevoke: () => void;
}) {
  const summary = summariseAuthorisation(authorisation);
  const state = authorisationStatePresentation(authorisation);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <DotStatusPill tone={state.tone} label={state.label} />
      <span className="order-last min-w-0 basis-full font-body text-sm text-on-surface sm:order-none sm:flex-1 sm:basis-0">
        {summary.scope} · {summary.limit} · {summary.window}
      </span>
      {canManage ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto min-h-11 text-error hover:text-error sm:ml-0 sm:min-h-9"
          onClick={onRevoke}
        >
          Revoke
        </Button>
      ) : null}
    </li>
  );
}

function AgentRow({
  agent,
  authorisations,
  entityName,
  canManage,
  onAuthorise,
  onRevoke,
}: {
  agent: AuthorisableBuyerAgent;
  authorisations: BuyerAgentAuthorisationView[];
  entityName: string;
  canManage: boolean;
  onAuthorise: () => void;
  onRevoke: (a: BuyerAgentAuthorisationView) => void;
}) {
  return (
    <li className="space-y-3 p-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-on-surface">{agent.name}</p>
          <p className="truncate font-body text-xs text-on-surface-variant">{agent.email}</p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={onAuthorise}
          >
            {authorisations.length > 0 ? "Add authorisation" : "Authorise"}
          </Button>
        ) : null}
      </div>
      {authorisations.length > 0 ? (
        <ul className="space-y-2">
          {authorisations.map((a) => (
            <AuthorisationLine
              key={a.id}
              authorisation={a}
              canManage={canManage}
              onRevoke={() => onRevoke(a)}
            />
          ))}
        </ul>
      ) : (
        <p className="font-body text-sm text-on-surface-variant">
          Not authorised yet, so they can&apos;t bid for {entityName}.
        </p>
      )}
    </li>
  );
}

/**
 * The organisation's buyer agents and what each may bid: all sales or one, a limit and dates.
 * Owners and admins authorise and revoke here; everyone else in those roles already bids.
 */
export function BuyerAgentsSection({ legalEntityId, entityName, overview }: Props) {
  const [authorising, setAuthorising] = useState<AuthorisableBuyerAgent | null>(null);
  const [revoking, setRevoking] = useState<BuyerAgentAuthorisationView | null>(null);
  const { buyerAgents, authorisations, sales, canManage } = overview;

  return (
    <Surface variant="section" padding="none" className="overflow-hidden p-0 sm:p-0">
      <div className="space-y-1 p-4 sm:px-5 sm:pt-5">
        <h3 className="font-headline text-base font-semibold text-on-surface">
          Who can bid for {entityName}
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          Owners and admins can always bid for the organisation. Buyer agents can bid once you
          authorise them, for all sales or one, with an optional limit. Other members bid only in
          their own name.
        </p>
      </div>
      {buyerAgents.length === 0 ? (
        <div className="border-t border-border-hairline">
          <EmptyState
            size="compact"
            headingLevel="h3"
            illustration="gavel"
            title="No buyer agents"
            description="Invite someone with the buyer agent role to bid on the organisation's behalf."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border-hairline border-t border-border-hairline">
          {buyerAgents.map((agent) => (
            <AgentRow
              key={agent.userId}
              agent={agent}
              authorisations={liveAuthorisationsFor(authorisations, agent.userId)}
              entityName={entityName}
              canManage={canManage}
              onAuthorise={() => setAuthorising(agent)}
              onRevoke={setRevoking}
            />
          ))}
        </ul>
      )}
      {authorising ? (
        <AuthoriseBuyerAgentDialog
          legalEntityId={legalEntityId}
          entityName={entityName}
          agent={authorising}
          sales={sales}
          open
          onOpenChange={(open) => {
            if (!open) setAuthorising(null);
          }}
        />
      ) : null}
      {revoking ? (
        <RevokeAuthorisationDialog
          legalEntityId={legalEntityId}
          entityName={entityName}
          authorisation={revoking}
          onClose={() => setRevoking(null)}
        />
      ) : null}
    </Surface>
  );
}
