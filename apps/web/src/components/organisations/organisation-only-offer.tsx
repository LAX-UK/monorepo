"use client";

import { useAccountChrome } from "@/components/layout/account-switcher/account-chrome-context";
import { SwitchAccountAction } from "@/components/layout/account-switcher/switch-account-action";
import { hopUrl } from "@/lib/navigation/hop-href";
import {
  type OrganisationOnlyPage,
  organisationOnlyView,
} from "@/lib/organisations/organisation-only-page.vm";
import { EmptyState } from "@auction/ui/components/empty-state";
import { ButtonLink } from "@auction/ui/lax/button-link";
import Link from "next/link";
import { useMemo } from "react";
import { AccountSwitchLink } from "./account-switch-link";

/**
 * What an organisation-only page shows someone using their personal account: whose it is and a
 * one-tap switch that opens this same page in the organisation. Nothing switches by itself.
 */
export function OrganisationOnlyOffer({ page }: { page: OrganisationOnlyPage }) {
  const options = useAccountChrome()?.switcher?.options;
  const view = useMemo(
    () =>
      organisationOnlyView(
        page,
        (options ?? [])
          .filter((option) => option.kind === "organisation")
          .map((option) => ({ id: option.id, name: option.name })),
      ),
    [page, options],
  );
  const { action } = view;
  return (
    <EmptyState
      size="page"
      variant="plain"
      headingLevel="h1"
      illustration="frame"
      title={view.title}
      description={view.description}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          {action.kind === "switch" ? (
            <ButtonLink variant="primary" Link={AccountSwitchLink} href={hopUrl(action.href)}>
              {action.label}
            </ButtonLink>
          ) : action.kind === "choose" ? (
            <SwitchAccountAction destination={page.path} emphasis="primary" />
          ) : (
            <ButtonLink variant="primary" Link={Link} href={action.href}>
              {action.label}
            </ButtonLink>
          )}
          <ButtonLink variant="secondary" Link={Link} href={view.back.href}>
            {view.back.label}
          </ButtonLink>
        </div>
      }
    />
  );
}
