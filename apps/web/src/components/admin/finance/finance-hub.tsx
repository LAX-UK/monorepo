"use client";

import {
  type AttentionItem,
  AttentionList,
  LinkList,
  type LinkListItem,
  Notice,
  PageHeader,
  type StaffLinkComponent,
} from "@auction/staff-ui";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

/**
 * The finance desk's start page: what needs someone, most urgent first and each linking to exactly
 * those records, then the places the desk works.
 */
export function FinanceHub({
  attention,
  tools,
  loadError,
}: {
  attention: readonly AttentionItem[];
  tools: readonly LinkListItem[];
  loadError?: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finance"
        description="Payments, payouts, disputes and the accounts, starting with what needs you."
      />
      {loadError ? (
        <Notice tone="warning" title="Some queues could not load">
          {loadError} The counts below may be incomplete.
        </Notice>
      ) : null}
      <AttentionList
        items={attention}
        Link={NextLink}
        allClear="Nothing in finance needs you right now."
      />
      <LinkList title="Finance tools" items={tools} Link={NextLink} />
    </div>
  );
}
