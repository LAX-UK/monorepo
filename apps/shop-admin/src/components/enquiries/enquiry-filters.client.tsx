"use client";

import { TransitionLink } from "@/components/enquiries/transition-link.client";
import { SelectField, TextField } from "@/components/forms/fields";
import {
  ENQUIRY_ASSIGNEE_LABELS,
  ENQUIRY_KIND_LABELS,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_TOPIC_LABELS,
  type EnquiryAssigneeFilter,
  type EnquiryInboxQuery,
  enquiryInboxHref,
} from "@/server/domain/enquiry-inbox.vm";
import {
  ENQUIRY_KINDS,
  ENQUIRY_SEARCH_MAX_LENGTH,
  ENQUIRY_STATUSES,
  ENQUIRY_TOPICS,
  type EnquiryKind,
  type EnquiryTopic,
} from "@auction/shop-contracts";
import { Button, FilterRow } from "@auction/ui";
import { type FormEvent, useState } from "react";

/** The blank value is "no filter"; SelectField swaps it for a sentinel Radix accepts. */
const KIND_OPTIONS: ReadonlyArray<{ value: EnquiryKind | ""; label: string }> = [
  { value: "", label: "All types" },
  ...ENQUIRY_KINDS.map((value) => ({ value, label: ENQUIRY_KIND_LABELS[value] })),
];
const TOPIC_OPTIONS: ReadonlyArray<{ value: EnquiryTopic | ""; label: string }> = [
  { value: "", label: "All topics" },
  ...ENQUIRY_TOPICS.map((value) => ({ value, label: ENQUIRY_TOPIC_LABELS[value] })),
];
const ASSIGNEE_OPTIONS: ReadonlyArray<{ value: EnquiryAssigneeFilter | ""; label: string }> = [
  { value: "", label: "Anyone" },
  ...(Object.keys(ENQUIRY_ASSIGNEE_LABELS) as EnquiryAssigneeFilter[]).map((value) => ({
    value,
    label: ENQUIRY_ASSIGNEE_LABELS[value],
  })),
];

/**
 * Every control writes to the URL, so a filtered inbox can be bookmarked, shared and reloaded.
 * `navigate` runs the move in the caller's transition so the list can show a loading state.
 */
export function EnquiryFilters({
  query,
  counts,
  navigate,
}: {
  query: EnquiryInboxQuery;
  counts: Record<"new" | "in_progress" | "closed", number>;
  navigate: (href: string) => void;
}) {
  const [search, setSearch] = useState(query.q ?? "");
  const total = counts.new + counts.in_progress + counts.closed;

  const statusItems = [
    { id: "all", label: "All", badge: total, status: null, active: !query.status },
    ...ENQUIRY_STATUSES.map((status) => ({
      id: status,
      label: ENQUIRY_STATUS_LABELS[status],
      badge: counts[status],
      status,
      active: query.status === status,
    })),
  ].map(({ status, ...item }) => ({ ...item, href: enquiryInboxHref(query, { status }) }));

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(enquiryInboxHref(query, { q: search.trim() || null }));
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterRow
        mode="link"
        label="Status"
        items={statusItems}
        renderLink={({ href, className, children, ...aria }) => (
          <TransitionLink href={href} className={className} navigateTo={navigate} {...aria}>
            {children}
          </TransitionLink>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,12rem))_1fr]">
        <SelectField
          name="kind"
          label="Type"
          value={query.kind ?? ""}
          options={KIND_OPTIONS}
          onChange={(kind) => navigate(enquiryInboxHref(query, { kind: kind || null }))}
        />
        <SelectField
          name="topic"
          label="Topic"
          value={query.topic ?? ""}
          options={TOPIC_OPTIONS}
          onChange={(topic) => navigate(enquiryInboxHref(query, { topic: topic || null }))}
        />
        <SelectField
          name="assignee"
          label="Assignee"
          value={query.assignee ?? ""}
          options={ASSIGNEE_OPTIONS}
          onChange={(assignee) => navigate(enquiryInboxHref(query, { assignee: assignee || null }))}
        />
        <form aria-label="Search enquiries" onSubmit={onSearch} className="flex items-end gap-2">
          <TextField
            name="search"
            label="Search"
            className="min-w-0 flex-1"
            value={search}
            onChange={setSearch}
            maxLength={ENQUIRY_SEARCH_MAX_LENGTH}
            placeholder="Name, email or message"
          />
          <Button type="submit" variant="outline" size="md">
            Search
          </Button>
        </form>
      </div>
    </div>
  );
}
