"use client";

import type { ActivityEntryView, ActivityQuery } from "@/lib/data/http/organisation-team.types";
import { teamHref } from "@/lib/navigation/client-routes";
import {
  ACTIVITY_GROUP_LABEL,
  ACTIVITY_PERIODS,
  ACTIVITY_PERIOD_LABEL,
  type ActivityFilters,
  DEFAULT_ACTIVITY_FILTERS,
  activityFiltered,
  activityFiltersSearch,
} from "@/lib/organisation-team/activity-filters";
import { activityDays, activityLine, activityTime } from "@/lib/organisation-team/activity-lines";
import { loadOlderActivityAction } from "@/lib/organisation-team/organisation-team.actions";
import { ACTIVITY_GROUPS, type ActivityGroup } from "@auction/domain";
import { Button, Notice, SelectMenu } from "@auction/ui/lax";
import {
  Download,
  Gavel,
  Landmark,
  type LucideIcon,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { TeamListEmpty, TeamListNoResults } from "./team-list-states";

const GROUP_ICON: Record<ActivityGroup, LucideIcon> = {
  members: Users,
  bidding: Gavel,
  selling: Package,
  money: Landmark,
  security: ShieldCheck,
};

type Props = {
  legalEntityId: string;
  organisationName: string;
  filters: ActivityFilters;
  /** Everyone in the team, for the person filter. */
  people: readonly { value: string; label: string }[];
  /** The first page; `null` when it could not be read. */
  page: { entries: ActivityEntryView[]; nextBefore: number | null } | null;
  /** The query the first page was read with, for the older pages. */
  query: ActivityQuery;
  exportHref: string;
  /** The day boundaries are drawn against this moment (from the server, so both agree). */
  now: string;
};

/**
 * Activity: who did what for the organisation, newest first and grouped by day, kept 12 months.
 * Filters for a person, a kind of change and a period live in the address; Export downloads
 * exactly what the filters show. Changes LAX made read "LAX".
 */
export function ActivityView({
  legalEntityId,
  organisationName,
  filters,
  people,
  page,
  query,
  exportHref,
  now,
}: Props) {
  const router = useRouter();
  const [older, setOlder] = useState<ActivityEntryView[]>([]);
  const [nextBefore, setNextBefore] = useState(page?.nextBefore ?? null);
  const [olderFailed, setOlderFailed] = useState(false);
  const [loading, startLoading] = useTransition();
  const [navigating, startNavigating] = useTransition();

  // Newest first by time, whatever order the pages arrive in.
  const entries = useMemo(
    () =>
      [...(page?.entries ?? []), ...older].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [page, older],
  );
  const days = useMemo(
    () =>
      activityDays(
        entries.map((entry) => activityLine(entry, organisationName)),
        new Date(now),
      ),
    [entries, organisationName, now],
  );

  const go = (next: ActivityFilters) =>
    startNavigating(() => router.push(`${teamHref("activity")}${activityFiltersSearch(next)}`));

  const showOlder = () => {
    if (!nextBefore) return;
    setOlderFailed(false);
    startLoading(async () => {
      const result = await loadOlderActivityAction(legalEntityId, { ...query, before: nextBefore });
      if (!result) {
        setOlderFailed(true);
        return;
      }
      setOlder((list) => [...list, ...result.entries]);
      setNextBefore(result.nextBefore);
    });
  };

  const toolbar = (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
        <SelectMenu
          label="Person"
          value={filters.person ?? "everyone"}
          onValueChange={(value) => go({ ...filters, person: value === "everyone" ? null : value })}
          options={[{ value: "everyone", label: "Everyone" }, ...people]}
          className="w-full md:w-48"
          disabled={navigating}
        />
        <SelectMenu
          label="Changes"
          value={filters.group ?? "all"}
          onValueChange={(value) =>
            go({ ...filters, group: value === "all" ? null : (value as ActivityGroup) })
          }
          options={[
            { value: "all", label: "All changes" },
            ...ACTIVITY_GROUPS.map((group) => ({
              value: group,
              label: ACTIVITY_GROUP_LABEL[group],
            })),
          ]}
          className="w-full md:w-40"
          disabled={navigating}
        />
        <SelectMenu
          label="Period"
          value={filters.period}
          onValueChange={(period) => go({ ...filters, period })}
          options={ACTIVITY_PERIODS.map((period) => ({
            value: period,
            label: ACTIVITY_PERIOD_LABEL[period],
          }))}
          className="col-span-2 w-full md:w-44"
          disabled={navigating}
        />
      </div>
      {/* Nothing to export until something is listed. */}
      {entries.length > 0 ? (
        <Button asChild className="md:ml-auto">
          <a href={exportHref} download>
            <Download aria-hidden />
            Export CSV
          </a>
        </Button>
      ) : null}
    </div>
  );

  let body: React.ReactNode;
  if (!page) {
    body = (
      <Notice
        tone="danger"
        alert
        title="We couldn't load Activity."
        actions={<Button onClick={() => router.refresh()}>Try again</Button>}
      >
        Nothing is lost. Try again in a moment.
      </Notice>
    );
  } else if (entries.length === 0) {
    body = activityFiltered(filters) ? (
      <TeamListNoResults query="" onClear={() => go(DEFAULT_ACTIVITY_FILTERS)} />
    ) : (
      <TeamListEmpty
        illustration="ledger"
        title="Nothing has changed yet"
        description={`When someone joins, changes a role, bids or sells for ${organisationName}, it's listed here.`}
      />
    );
  } else {
    body = (
      <div className="overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
        {days.map((day) => (
          <section key={day.key} aria-label={day.label}>
            <h2 className="border-b border-lax-line-subtle bg-lax-sunken px-4 py-2 text-lax-12 font-medium text-lax-muted md:px-5">
              {day.label}
            </h2>
            <ul className="divide-y divide-lax-line-subtle">
              {day.lines.map((line) => {
                const Icon = GROUP_ICON[line.group];
                return (
                  <li key={line.id} className="flex items-start gap-3 px-4 py-3 md:gap-4 md:px-5">
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-lax-badge bg-lax-paper text-lax-muted"
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-lax-14 font-medium text-lax-fg">{line.sentence}</span>
                      <span className="text-lax-12 text-lax-muted">
                        <time dateTime={line.occurredAt}>{activityTime(line.occurredAt)}</time>
                        {line.note ? ` · ${line.note}` : null}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={navigating || undefined}>
      {toolbar}
      {body}
      {nextBefore ? (
        <div className="flex flex-col items-center gap-2">
          {olderFailed ? (
            <p role="alert" className="text-lax-13 text-lax-danger">
              We couldn't load older changes. Try again.
            </p>
          ) : null}
          <Button loading={loading} onClick={showOlder}>
            Show older
          </Button>
        </div>
      ) : null}
      <p className="text-lax-12 text-lax-muted">
        Kept for 12 months. Each person&apos;s sign-ins and security are in their LAX Account.
      </p>
    </div>
  );
}
