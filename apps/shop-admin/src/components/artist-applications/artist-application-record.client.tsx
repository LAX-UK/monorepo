"use client";

import {
  type ArtistApplicationTarget,
  useArtistApplicationActions,
} from "@/components/artist-applications/use-artist-application-actions.client";
import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import {
  ARTIST_APPLICATION_LIST_PATH,
  applicationTitle,
  historyEvents,
  reviewerName,
  staffActionsFor,
  workGalleryItems,
} from "@/server/domain/artist-application.vm";
import { presentStatus } from "@/server/domain/staff-status";
import type {
  AdminArtistApplicationDetail,
  ArtistApplicationReviewer,
} from "@auction/shop-contracts";
import {
  DetailPage,
  type EnumOption,
  EnumSelect,
  Field,
  ImageGallery,
  KeyValueList,
  MappedStatusBadge,
  MetaItem,
  Notice,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  TextLink,
  Timeline,
  formatStaffDate,
} from "@auction/staff-ui";
import { CircleCheck, MessageSquareText, UserPlus, XCircle } from "@auction/staff-ui/icons";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;
const presentApplicationStatus = presentStatus("artistApplication");
const NO_REVIEWER = "__none__";

/** Long answers keep the artist's own line breaks and never run wider than a reading measure. */
function Prose({ children }: { children: string }) {
  return (
    <p className="max-w-[72ch] whitespace-pre-wrap text-staff-sm leading-6 text-staff-fg">
      {children}
    </p>
  );
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * One application, with the works first: what the artist sent in a gallery that opens each work
 * large, then who they are and their statement. The rail holds the reviewer, the applicant's
 * contact and the history. The header's actions are the transition table's: accept and ask for
 * more while under review, decline in the menu, nothing once decided.
 */
export function ArtistApplicationRecord({
  detail,
  reviewers,
  currentSubject,
}: {
  detail: AdminArtistApplicationDetail;
  reviewers: readonly ArtistApplicationReviewer[];
  currentSubject: string;
}) {
  const actions = useArtistApplicationActions({ currentSubject });
  const resolveImage = useStaffCatalogueImage();
  const title = applicationTitle(detail);
  const allowed = staffActionsFor(detail.status);
  const target: ArtistApplicationTarget = {
    id: detail.id,
    version: detail.version,
    title,
    workCount: detail.works.length,
    artistName: detail.artistName,
  };

  const staff =
    detail.assignee && !reviewers.some((person) => person.subject === detail.assignee?.subject)
      ? [detail.assignee, ...reviewers]
      : reviewers;
  const reviewerOptions: EnumOption<string>[] = [
    { value: NO_REVIEWER, label: "No reviewer" },
    ...staff.map((person) => ({
      value: person.subject,
      label:
        person.subject === currentSubject ? `${reviewerName(person)} (you)` : reviewerName(person),
    })),
  ];
  const mine = detail.assignee?.subject === currentSubject;

  const statusNotice = actions.conflict ? (
    <Notice
      tone="warning"
      alert
      title="This application changed"
      actions={
        <StaffButton variant="secondary" size="sm" onClick={actions.reload}>
          Reload application
        </StaffButton>
      }
    >
      Someone else updated it while you had it open. Reload to see their change, then make yours
      again.
    </Notice>
  ) : detail.status === "more_info_needed" ? (
    <Notice tone="info" title="Waiting on the artist">
      {detail.messageToArtist
        ? `You asked: “${detail.messageToArtist}” The application comes back to the reviewer when the artist sends it.`
        : "The application comes back to the reviewer when the artist sends it."}
    </Notice>
  ) : detail.status === "accepted" ? (
    <Notice
      tone="success"
      title={`Accepted${detail.decidedAt ? ` on ${formatStaffDate(detail.decidedAt)}` : ""}`}
      {...(detail.artist
        ? {
            actions: (
              <StaffButton asChild variant="secondary" size="sm">
                <Link href={`/artists/${detail.artist.id}`}>Open artist profile</Link>
              </StaffButton>
            ),
          }
        : {})}
    >
      The artist has their profile and the artist portal.
    </Notice>
  ) : detail.status === "declined" ? (
    <Notice
      tone="info"
      title={`Declined${detail.decidedAt ? ` on ${formatStaffDate(detail.decidedAt)}` : ""}`}
    >
      {detail.messageToArtist ? `Reason sent: “${detail.messageToArtist}” ` : ""}
      {detail.reapplyFrom
        ? `They can apply again from ${formatStaffDate(detail.reapplyFrom)}.`
        : null}
    </Notice>
  ) : null;

  const declineAction = allowed.has("decline")
    ? [
        {
          id: "decline",
          label: "Decline…",
          icon: XCircle,
          tone: "danger" as const,
          onSelect: () => actions.requestDecline(target),
        },
      ]
    : [];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[
              { label: "Artist applications", href: ARTIST_APPLICATION_LIST_PATH },
              { label: title },
            ]}
          />
        }
        title={title}
        status={<MappedStatusBadge status={detail.status} present={presentApplicationStatus} />}
        meta={
          <>
            <MetaItem label="Reference">{detail.reference}</MetaItem>
            <MetaItem label="Sent">
              <StaffDate value={detail.submittedAt} />
            </MetaItem>
            {detail.location ? <MetaItem label="Based in">{detail.location}</MetaItem> : null}
          </>
        }
        resource="applications"
        primaryAction={
          allowed.has("accept") ? (
            <StaffButton
              variant="primary"
              icon={<CircleCheck aria-hidden />}
              onClick={() => actions.requestAccept(target)}
            >
              Accept
            </StaffButton>
          ) : null
        }
        secondaryActions={
          allowed.has("request_info") ? (
            <StaffButton
              variant="secondary"
              icon={<MessageSquareText aria-hidden />}
              onClick={() => actions.requestInformation(target)}
            >
              Ask for more
            </StaffButton>
          ) : null
        }
        overflow={
          declineAction.length > 0 ? (
            <OverflowMenu label={`More actions for ${title}`} actions={declineAction} />
          ) : null
        }
        notice={statusNotice}
        rail={
          <>
            <Section title="Review">
              {allowed.has("assign") ? (
                <div className="flex flex-col gap-3">
                  <Field label="Reviewer">
                    <EnumSelect
                      value={detail.assignee?.subject ?? NO_REVIEWER}
                      options={reviewerOptions}
                      disabled={actions.pending}
                      onValueChange={(value) => {
                        if (value === (detail.assignee?.subject ?? NO_REVIEWER)) return;
                        const person = staff.find((member) => member.subject === value) ?? null;
                        void actions.assign(
                          target,
                          value === NO_REVIEWER ? null : person,
                          person ? reviewerName(person) : "them",
                        );
                      }}
                    />
                  </Field>
                  {mine ? null : (
                    <div>
                      <StaffButton
                        variant="secondary"
                        size="sm"
                        icon={<UserPlus aria-hidden />}
                        disabled={actions.pending}
                        onClick={() => void actions.assignToMe(target)}
                      >
                        Assign to me
                      </StaffButton>
                    </div>
                  )}
                </div>
              ) : (
                <KeyValueList
                  items={[{ label: "Reviewer", value: reviewerName(detail.assignee) }]}
                />
              )}
            </Section>

            <Section title="Applicant">
              <KeyValueList
                items={[
                  ...(detail.applicant.name
                    ? [{ label: "Account name", value: detail.applicant.name }]
                    : []),
                  {
                    label: "Email",
                    value: detail.applicant.email ? (
                      <TextLink href={`mailto:${detail.applicant.email}`}>
                        {detail.applicant.email}
                      </TextLink>
                    ) : (
                      "Not on file"
                    ),
                    ...(detail.applicant.email ? { copyValue: detail.applicant.email } : {}),
                  },
                  { label: "Account", value: "LAX Account member" },
                ]}
              />
            </Section>

            <Section title="History">
              <Timeline events={historyEvents(detail)} label={`History of ${title}`} />
            </Section>

            <Section title="Details">
              <KeyValueList
                items={[
                  { label: "Reference", value: detail.reference, copyValue: detail.reference },
                  { label: "Application ID", value: detail.id, copyValue: detail.id },
                ]}
              />
            </Section>
          </>
        }
      >
        <Section
          title="Works"
          description={`${detail.works.length} ${detail.works.length === 1 ? "work" : "works"} sent with the application. Select one to see it large.`}
        >
          <ImageGallery
            items={workGalleryItems(detail.works, resolveImage)}
            label={`Works sent by ${title}`}
          />
        </Section>

        <Section title="About the artist">
          <div className="flex flex-col gap-4">
            <KeyValueList
              items={[
                { label: "Name as an artist", value: detail.artistName ?? "" },
                { label: "Based in", value: detail.location ?? "" },
                {
                  label: "Website",
                  value: detail.website ? (
                    <TextLink href={detail.website} external>
                      {hostOf(detail.website)}
                    </TextLink>
                  ) : (
                    ""
                  ),
                },
                ...(detail.socialLinks.length > 0
                  ? [
                      {
                        label: "Social",
                        value: (
                          <ul className="flex flex-col gap-1">
                            {detail.socialLinks.map((link) => (
                              <li key={link}>
                                <TextLink href={link} external>
                                  {hostOf(link)}
                                </TextLink>
                              </li>
                            ))}
                          </ul>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            {detail.shortBio ? <Prose>{detail.shortBio}</Prose> : null}
          </div>
        </Section>

        <Section title="Statement">
          <div className="flex flex-col gap-5">
            {detail.statement ? <Prose>{detail.statement}</Prose> : null}
            {detail.representation ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-staff-sm font-medium text-staff-muted">
                  Current representation
                </h3>
                <Prose>{detail.representation}</Prose>
              </div>
            ) : null}
            {detail.exhibitions ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-staff-sm font-medium text-staff-muted">Exhibitions</h3>
                <Prose>{detail.exhibitions}</Prose>
              </div>
            ) : null}
          </div>
        </Section>
      </DetailPage>
      {actions.dialogs}
    </>
  );
}
