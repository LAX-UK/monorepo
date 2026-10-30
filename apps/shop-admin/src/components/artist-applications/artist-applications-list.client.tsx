"use client";

import {
  type ArtistApplicationTarget,
  useArtistApplicationActions,
} from "@/components/artist-applications/use-artist-application-actions.client";
import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import { filterChip, knownFacts, useWorkList } from "@/components/use-work-list.client";
import {
  type ArtistApplicationsListState,
  applicationTitle,
  artistApplicationPath,
  artistApplicationsList,
  reviewerName,
} from "@/server/domain/artist-application.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type {
  AdminArtistApplicationListItem,
  AdminArtistApplicationListResponse,
  ArtistApplicationReviewer,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  DetailPanel,
  FilterSheet,
  ListPage,
  MappedStatusBadge,
  type OverflowAction,
  OverflowMenu,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StaffDialog,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { FileText, UserMinus, UserPlus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useMemo } from "react";

const presentApplicationStatus = presentStatus("artistApplication");
const noun = { one: "application", other: "applications" };

function toTarget(item: AdminArtistApplicationListItem): ArtistApplicationTarget {
  return {
    id: item.id,
    version: item.version,
    title: applicationTitle(item),
    workCount: item.workCount,
    artistName: item.artistName,
  };
}

const OPEN = new Set(["submitted", "in_review", "more_info_needed"]);

/**
 * Artists' applications to join the gallery, on the staff list template: New first by default,
 * a view per stage with counts (the saved views staff asked for: new, in review, waiting on the
 * artist), search by name, place, reference or email, a reviewer filter, and a triage panel
 * linked from the URL. Decisions are taken on the application itself, with its works in view.
 */
export function ArtistApplicationsList({
  state,
  page,
  currentSubject,
  reviewers,
  loadFailed = false,
}: {
  state: ArtistApplicationsListState;
  page: AdminArtistApplicationListResponse;
  currentSubject: string;
  reviewers: readonly ArtistApplicationReviewer[];
  loadFailed?: boolean;
}) {
  const list = useWorkList({
    list: artistApplicationsList,
    state,
    page,
    noun,
    search: { label: "Search applications", placeholder: "Search by name, place or reference" },
  });
  const actions = useArtistApplicationActions({ currentSubject });
  const resolveImage = useStaffCatalogueImage();
  const opened = list.panel.openId
    ? (page.items.find((item) => item.id === list.panel.openId) ?? null)
    : null;

  const columns = useMemo<DataColumn<AdminArtistApplicationListItem>[]>(
    () => [
      {
        id: "artist",
        header: "Artist",
        mobile: "title",
        truncate: false,
        cell: (row) => (
          <PrimaryCell
            href={list.panelHref(row.id)}
            Link={list.panel.PanelLink}
            secondary={row.location ?? undefined}
            thumbnail={{ src: resolveImage(row.coverImageUrl), missingLabel: "No works yet" }}
          >
            {applicationTitle(row)}
          </PrimaryCell>
        ),
      },
      {
        id: "reference",
        header: "Reference",
        width: "136px",
        hideBelow: "md",
        mobile: "meta",
        truncate: false,
        cell: (row) => row.reference,
      },
      {
        id: "works",
        header: "Works",
        width: "88px",
        numeric: true,
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => row.workCount,
      },
      {
        id: "status",
        header: "Status",
        width: "168px",
        mobile: "badge",
        truncate: false,
        cell: (row) => <MappedStatusBadge status={row.status} present={presentApplicationStatus} />,
      },
      {
        id: "reviewer",
        header: "Reviewer",
        width: "18%",
        hideBelow: "lg",
        mobile: "hidden",
        cell: (row) => reviewerName(row.assignee),
      },
      {
        id: "submitted",
        header: "Sent",
        width: "168px",
        sortable: true,
        defaultSortDirection: "desc",
        mobile: "meta",
        truncate: false,
        cell: (row) => <StaffDate value={row.submittedAt} withTime />,
      },
    ],
    [list.panelHref, list.panel.PanelLink, resolveImage],
  );

  const colleagues = reviewers.filter((person) => person.subject !== currentSubject);
  const reviewerChip = filterChip(
    artistApplicationsList,
    state,
    list.navigate,
    "assignee",
    (value) => {
      if (value === "me") return "Reviewer: me";
      if (value === "unassigned") return "No reviewer";
      const person = reviewers.find((candidate) => candidate.subject === value);
      return `Reviewer: ${person ? reviewerName(person) : "a colleague"}`;
    },
  );

  const rowMenu = (row: AdminArtistApplicationListItem): OverflowAction[] => {
    const mine = row.assignee?.subject === currentSubject;
    const target = toTarget(row);
    return [
      {
        id: "open",
        label: "Open application",
        icon: FileText,
        href: artistApplicationPath(row.id),
      },
      ...(OPEN.has(row.status)
        ? mine
          ? [
              {
                id: "unassign",
                label: "Remove me as reviewer",
                icon: UserMinus,
                onSelect: () => void actions.assign(target, null, ""),
              },
            ]
          : [
              {
                id: "assign-me",
                label: "Assign to me",
                icon: UserPlus,
                onSelect: () => void actions.assignToMe(target),
              },
            ]
        : []),
    ];
  };

  return (
    <>
      <ListPage<AdminArtistApplicationListItem>
        title="Artist applications"
        description="Artists applying to join the gallery from lax.art. Pick one up, look at the work, and accept, decline or ask the artist for more."
        Link={list.Link}
        listKey="lax-admin.artist-applications"
        views={list.views}
        search={list.search}
        filters={
          <FilterSheet
            title="Filter applications"
            sections={[
              {
                kind: "radio",
                id: "assignee",
                label: "Reviewer",
                anyLabel: "Anyone",
                options: [
                  { value: "me", label: "Me" },
                  { value: "unassigned", label: "No reviewer" },
                  ...colleagues.map((person) => ({
                    value: person.subject,
                    label: reviewerName(person),
                  })),
                ],
                value: state.filters.assignee ?? "",
              },
            ]}
            onApply={(values) =>
              list.navigate(
                artistApplicationsList.href(state, {
                  assignee: (values.assignee as string) || null,
                }),
              )
            }
          />
        }
        activeFilters={[...list.searchChip, ...reviewerChip]}
        onClearFilters={list.clearFilters}
        loading={list.pending}
        filtered={list.filtered}
        error={
          loadFailed
            ? {
                title: "Applications did not load",
                description: "Something went wrong on our side. Try again in a moment.",
                onRetry: () => list.navigate(artistApplicationsList.href(state)),
              }
            : null
        }
        empty={
          state.view === "new"
            ? {
                illustration: "plinth",
                title: "No new applications",
                description: "Applications artists send from lax.art arrive here.",
              }
            : state.view === "waiting"
              ? {
                  illustration: "plinth",
                  title: "Nobody to wait for",
                  description: "When you ask an artist for more, their application waits here.",
                }
              : {
                  illustration: "plinth",
                  title: "No applications here",
                  description: "Applications move here as they are reviewed and decided.",
                }
        }
        noResults={{ noun: "applications" }}
        table={{
          columns,
          data: page.items,
          getRowId: (row) => row.id,
          defaultDensity: "comfortable",
          ...list.sort,
          onRowOpen: (row) => list.panel.show(row.id),
          activeRowId: list.panel.openId,
          rowActions: {
            label: (row) => `Actions for ${applicationTitle(row)}`,
            actions: rowMenu,
          },
        }}
        pageSize={list.pageSize}
        pagination={list.pagination}
      />

      <DetailPanel
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) list.panel.show(null);
        }}
        title={opened ? applicationTitle(opened) : "Application"}
        status={
          opened ? (
            <MappedStatusBadge status={opened.status} present={presentApplicationStatus} />
          ) : null
        }
        meta={
          opened
            ? [
                { label: "Reference", value: opened.reference },
                { label: "Reviewer", value: reviewerName(opened.assignee) },
              ]
            : []
        }
        summary={
          opened
            ? knownFacts([
                { label: "Based in", value: opened.location ?? "" },
                {
                  label: "Works",
                  value: `${opened.workCount} ${opened.workCount === 1 ? "work" : "works"}`,
                },
                ...(opened.applicant.email
                  ? [
                      {
                        label: "Email",
                        value: opened.applicant.email,
                        copyValue: opened.applicant.email,
                      },
                    ]
                  : []),
                {
                  label: "Sent",
                  value: formatStaffDateTime(opened.submittedAt, { zoneLabel: true }),
                },
              ])
            : []
        }
        overflow={
          opened && OPEN.has(opened.status) ? (
            <OverflowMenu
              label={`More actions for ${applicationTitle(opened)}`}
              actions={rowMenu(opened).filter((action) => action.id !== "open")}
            />
          ) : null
        }
        footer={
          opened ? (
            <StaffButton asChild variant="primary" icon={<FileText aria-hidden />}>
              <Link href={artistApplicationPath(opened.id)}>Open application</Link>
            </StaffButton>
          ) : null
        }
      >
        {null}
      </DetailPanel>

      {actions.dialogs}
      <StaffDialog
        open={actions.conflict}
        onOpenChange={(open) => {
          if (!open) actions.dismissConflict();
        }}
        title="This application changed"
        description="Someone else updated it while you had it open. Reload to see their change, then try again."
        footer={
          <StaffButton variant="primary" onClick={actions.reload}>
            Reload
          </StaffButton>
        }
      />
    </>
  );
}
