"use client";

import { useListNavigation } from "@/components/use-list-navigation.client";
import { QueueRowLink } from "@/components/use-work-queue.client";
import { leadsViews } from "@/server/domain/lead-list.vm";
import { releaseAlertMetricStrip } from "@/server/domain/release-alert-metrics";
import {
  RELEASE_ALERT_SENDS_COPY as COPY,
  RELEASE_ALERT_STATUS_NOTICE,
} from "@/server/domain/release-alert-sends.copy";
import {
  RELEASE_ALERT_PANEL_PARAM,
  type ReleaseAlertSendsState,
  formatReleaseAlertCount,
  presentReleaseAlertStatus,
  releaseAlertCountFacts,
  releaseAlertNotSentSentences,
  releaseAlertPageHref,
  releaseAlertPanelHref,
  releaseAlertPhoneCounts,
  releaseAlertPublishedAt,
  releaseAlertPublishedBy,
} from "@/server/domain/release-alert-sends.vm";
import { pageSummary } from "@/server/domain/work-list.vm";
import type {
  AdminReleaseAlertSend,
  AdminReleaseAlertSendList,
  AdminReleaseAlertSummary,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  DataViews,
  DetailPanel,
  KeyValueList,
  ListPage,
  MappedStatusBadge,
  Notice,
  type OverflowAction,
  type PanelQueue,
  PanelSection,
  PrimaryCell,
  StaffButton,
  type StaffLinkComponent,
  useQueuePanel,
} from "@auction/staff-ui";
import { ArrowUpRight, PanelRight } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

/** A London time in the LAX date style, in a `<time>` with its instant. */
function PublishedTime({ row }: { row: AdminReleaseAlertSend }) {
  const at = releaseAlertPublishedAt(row);
  return (
    <time dateTime={at.dateTime} className="tabular-nums">
      {at.text}
    </time>
  );
}

/**
 * The release-alert send log (docs/design/staff-gaps-delivery-zoho-alerts.md, LA-3): a view tab on
 * the Leads page, one row per published edition release, newest first, with what its alert did. A
 * release has no page of its own, so its row opens a panel that is the record (PRD-7): its URL
 * (`?release=`) is the link to share, Back closes it and J and K step through the rows shown.
 * Counts only; nobody on the list is named (Q9).
 */
export function ReleaseAlertSendLog({
  state,
  page,
  loadFailed = false,
  summary,
  capabilities,
  canOpenArtwork,
}: {
  state: ReleaseAlertSendsState;
  page: AdminReleaseAlertSendList;
  loadFailed?: boolean;
  /** The list's size for the figures above; null when it could not be read. */
  summary: AdminReleaseAlertSummary | null;
  /** The viewer's capabilities, for the tabs. */
  capabilities: readonly string[];
  /** Whether the viewer's role can open an artwork's page. */
  canOpenArtwork: boolean;
}) {
  const { pending, navigate, Link: ListLink } = useListNavigation();
  const hrefFor = useCallback((id: string | null) => releaseAlertPanelHref(state, id), [state]);
  const ids = useMemo(() => page.items.map((row) => row.artworkId), [page.items]);
  const panel = useQueuePanel({
    param: RELEASE_ALERT_PANEL_PARAM,
    ids,
    initialId: state.open ?? null,
    noun: COPY.panel.queueNoun,
    hrefFor,
  });
  const opened = page.items.find((row) => row.artworkId === panel.openId) ?? null;
  const artworkHref = (row: AdminReleaseAlertSend) =>
    canOpenArtwork ? `/artworks/${row.artworkId}` : null;

  const columns = useMemo<DataColumn<AdminReleaseAlertSend>[]>(
    () => [
      {
        id: "edition",
        header: COPY.columns.edition,
        mobile: "title",
        minWidth: "220px",
        cell: (row) => (
          <PrimaryCell
            href={hrefFor(row.artworkId)}
            Link={QueueRowLink}
            thumbnail={{ src: row.imageUrl, missingLabel: COPY.noThumbnail }}
          >
            {row.title}
          </PrimaryCell>
        ),
      },
      {
        id: "published",
        header: COPY.columns.published,
        width: "200px",
        hideBelow: "md",
        truncate: false,
        cell: (row) => {
          const by = releaseAlertPublishedBy(row);
          return (
            <span className="flex min-w-0 flex-col">
              <span className="text-staff-fg">
                <PublishedTime row={row} />
              </span>
              {by ? <span className="truncate text-staff-xs text-staff-muted">{by}</span> : null}
            </span>
          );
        },
      },
      {
        id: "told",
        header: COPY.columns.toldSubscribers,
        width: "136px",
        hideBelow: "xl",
        cell: (row) => (row.toldSubscribers ? COPY.yes : COPY.no),
      },
      {
        id: "matched",
        header: COPY.columns.matched,
        width: "120px",
        numeric: true,
        hideBelow: "lg",
        cell: (row) => formatReleaseAlertCount(row.matched),
      },
      {
        id: "emailed",
        header: COPY.columns.emailed,
        width: "96px",
        numeric: true,
        hideBelow: "md",
        cell: (row) => formatReleaseAlertCount(row.emailed),
      },
      {
        id: "waiting",
        header: COPY.columns.waiting,
        width: "96px",
        numeric: true,
        hideBelow: "lg",
        cell: (row) => formatReleaseAlertCount(row.waiting),
      },
      {
        id: "notSent",
        header: COPY.columns.notSent,
        width: "96px",
        numeric: true,
        hideBelow: "lg",
        cell: (row) => formatReleaseAlertCount(row.notSent),
      },
      {
        id: "status",
        header: COPY.columns.status,
        width: "152px",
        mobile: "badge",
        truncate: false,
        cell: (row) => (
          <MappedStatusBadge status={row.status} present={presentReleaseAlertStatus} />
        ),
      },
      {
        // At 375 px the row reads "Edition · status · Emailed 398 of 412".
        id: "phoneCounts",
        header: COPY.columns.phoneCounts,
        phoneOnly: true,
        mobile: "meta",
        cell: (row) => releaseAlertPhoneCounts(row),
      },
    ],
    [hrefFor],
  );

  const rowActions = (row: AdminReleaseAlertSend): OverflowAction[] => {
    const artwork = artworkHref(row);
    return [
      {
        id: "open",
        label: COPY.openRelease,
        icon: PanelRight,
        onSelect: () => panel.open(row.artworkId),
      },
      ...(artwork ? [{ id: "artwork", label: COPY.openArtwork, href: artwork }] : []),
    ];
  };

  return (
    <>
      <ListPage<AdminReleaseAlertSend>
        title={COPY.pageTitle}
        description={COPY.description}
        Link={ListLink}
        listKey="lax-admin.release-alert-sends"
        {...releaseAlertMetricStrip(summary)}
        views={
          <DataViews
            views={leadsViews({}, null, capabilities)}
            activeId="release-alerts"
            Link={ListLink}
          />
        }
        loading={pending}
        filtered={false}
        error={
          loadFailed
            ? {
                title: COPY.error.title,
                description: COPY.error.description,
                onRetry: () => navigate(releaseAlertPageHref(state.cursor ?? null)),
              }
            : null
        }
        empty={{ illustration: "ledger", ...COPY.empty }}
        noResults={{ noun: COPY.noResultsNoun }}
        table={{
          label: COPY.tab,
          columns,
          data: page.items,
          getRowId: (row) => row.artworkId,
          // Each row has a thumbnail and the publisher on a second line.
          defaultDensity: "comfortable",
          onRowOpen: (row) => panel.open(row.artworkId),
          rowHref: (row) => hrefFor(row.artworkId),
          activeRowId: panel.openId,
          rowActions: { label: (row) => COPY.rowActions(row.title), actions: rowActions },
        }}
        pageSize={null}
        pagination={
          page.items.length > 0
            ? {
                summary: pageSummary(page.items.length, COPY.pageSummary),
                prevHref: state.cursor ? releaseAlertPageHref(null) : null,
                prevLabel: COPY.firstPage,
                nextHref: page.nextCursor ? releaseAlertPageHref(page.nextCursor) : null,
              }
            : null
        }
      />
      <ReleaseAlertPanel
        row={opened}
        artworkHref={opened ? artworkHref(opened) : null}
        queueProps={panel.queue ? { queue: panel.queue } : {}}
        onOpenChange={panel.onOpenChange}
      />
    </>
  );
}

/** One release in full: when and by whom, what was sent, and why some were not. */
function ReleaseAlertPanel({
  row,
  artworkHref,
  queueProps,
  onOpenChange,
}: {
  row: AdminReleaseAlertSend | null;
  artworkHref: string | null;
  queueProps: { queue?: PanelQueue };
  onOpenChange: (open: boolean) => void;
}) {
  const notice = row ? RELEASE_ALERT_STATUS_NOTICE[row.status] : null;
  const reasons = row ? releaseAlertNotSentSentences(row) : [];
  return (
    <DetailPanel
      open={row !== null}
      onOpenChange={onOpenChange}
      {...queueProps}
      title={row?.title ?? COPY.panel.fallbackTitle}
      status={
        row ? <MappedStatusBadge status={row.status} present={presentReleaseAlertStatus} /> : null
      }
      meta={
        row
          ? [
              { label: COPY.panel.published, value: <PublishedTime row={row} /> },
              {
                label: COPY.panel.publishedBy,
                value: row.publishedByName ?? COPY.panel.noPublisher,
              },
            ]
          : []
      }
      headerActions={
        artworkHref ? (
          <StaffButton asChild size="sm" variant="ghost" icon={<ArrowUpRight aria-hidden />}>
            <NextLink href={artworkHref}>{COPY.openArtwork}</NextLink>
          </StaffButton>
        ) : null
      }
      notice={
        notice && row ? (
          <Notice tone={row.status === "not_sent_yet" ? "danger" : "info"} title={notice} />
        ) : null
      }
    >
      {row ? (
        <div className="flex flex-col">
          <PanelSection title={COPY.panel.counts}>
            <KeyValueList items={releaseAlertCountFacts(row)} />
          </PanelSection>
          {reasons.length > 0 ? (
            <PanelSection title={COPY.panel.reasons}>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-staff-sm text-staff-fg">
                {reasons.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </PanelSection>
          ) : null}
        </div>
      ) : null}
    </DetailPanel>
  );
}
