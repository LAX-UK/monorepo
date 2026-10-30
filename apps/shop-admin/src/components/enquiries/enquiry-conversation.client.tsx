"use client";

import {
  type EnquiryTarget,
  useEnquiryActions,
} from "@/components/enquiries/use-enquiry-actions.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import { addEnquiryNote } from "@/server/application/admin-enquiry-actions.server";
import type { EnquiryContextLink } from "@/server/domain/enquiry-detail.vm";
import {
  ENQUIRY_LIST_PATH,
  ENQUIRY_TOPIC_LABELS,
  enquirySenderName,
  enquiryStaffName,
} from "@/server/domain/enquiry-inbox.vm";
import { presentStatus } from "@/server/domain/staff-status";
import {
  type AdminEnquiryDetail,
  ENQUIRY_NOTE_MAX_LENGTH,
  type EnquiryAssignee,
} from "@auction/shop-contracts";
import {
  DetailPage,
  EmptyState,
  type EnumOption,
  EnumSelect,
  Field,
  FormActions,
  FormErrorSummary,
  KeyValueList,
  MappedStatusBadge,
  MetaItem,
  Notice,
  RecordImage,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  TextArea,
  TextLink,
  UnsavedChangesDialog,
  toast,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { CircleCheck, RotateCcw, UserPlus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const NextLink: StaffLinkComponent = Link;
const presentEnquiryStatus = presentStatus("enquiry");
const UNASSIGNED = "__unassigned__";
const NOTE_FIELD_ID = "enquiry-note";

/**
 * The staff conversation about one enquiry: the client's message first, then the notes staff
 * have kept, and a composer for the next note. Notes are internal; the client is not emailed, so
 * a reply goes from your own mailbox (the client's email is in the side column). The side column
 * holds the work the enquiry is about, the client, who has picked it up, and the record's
 * details. Close and reopen sit in the header.
 */
export function EnquiryConversation({
  detail,
  assignees,
  currentSubject,
  canWrite,
  contextLinks,
  initialNote = "",
  initialNoteError,
}: {
  detail: AdminEnquiryDetail;
  /** Active staff who can handle enquiries. */
  assignees: readonly EnquiryAssignee[];
  currentSubject: string;
  canWrite: boolean;
  /** Where the enquiry came from, with public addresses where known. */
  contextLinks: readonly EnquiryContextLink[];
  /** Text to start the composer with. */
  initialNote?: string;
  /** A note error to show from the start. */
  initialNoteError?: string;
}) {
  const router = useRouter();
  const actions = useEnquiryActions({ currentSubject });
  const senderName = enquirySenderName(detail.sender);
  const target: EnquiryTarget = {
    kind: detail.kind,
    id: detail.id,
    version: detail.version,
    status: detail.status,
    assignee: detail.assignee,
    sender: detail.sender,
  };
  const closed = detail.status === "closed";
  const topic = ENQUIRY_TOPIC_LABELS[detail.topic];

  const [note, setNote] = useState(initialNote);
  const [noteError, setNoteError] = useState<string | undefined>(initialNoteError);
  const [failedSubmits, setFailedSubmits] = useState(initialNoteError ? 1 : 0);
  const [adding, setAdding] = useState(false);
  const guard = useUnsavedChanges(canWrite && note.trim().length > 0, {
    navigate: (href) => router.push(href),
    label: "your note",
  });

  function validate(text: string): string | undefined {
    if (!text.trim()) return "Write a note before adding it.";
    if (text.length > ENQUIRY_NOTE_MAX_LENGTH) {
      return `Keep the note under ${ENQUIRY_NOTE_MAX_LENGTH.toLocaleString("en-GB")} characters.`;
    }
    return undefined;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(note);
    if (found) {
      setNoteError(found);
      setFailedSubmits((count) => count + 1);
      return;
    }
    setNoteError(undefined);
    setAdding(true);
    const result = await addEnquiryNote({ kind: detail.kind, id: detail.id, body: note }).catch(
      () => ({ ok: false, kind: "failed", message: "The note did not save. Try again." }) as const,
    );
    setAdding(false);
    if (!result.ok) {
      setNoteError(adminMutationErrorMessage(result));
      setFailedSubmits((count) => count + 1);
      return;
    }
    setNote("");
    toast.success("Note added");
    router.refresh();
  }

  const artworkLink = contextLinks.find((link) => link.label === "Artwork");
  const pageLink = contextLinks.find((link) => link.label !== "Artwork");

  const staff =
    detail.assignee && !assignees.some((member) => member.subject === detail.assignee?.subject)
      ? [detail.assignee, ...assignees]
      : assignees;
  const assigneeOptions: EnumOption<string>[] = [
    { value: UNASSIGNED, label: "Unassigned" },
    ...staff.map((member) => ({
      value: member.subject,
      label:
        member.subject === currentSubject
          ? `${enquiryStaffName(member)} (you)`
          : enquiryStaffName(member),
    })),
  ];
  const mine = detail.assignee?.subject === currentSubject;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Enquiries", href: ENQUIRY_LIST_PATH }, { label: senderName }]}
          />
        }
        title={senderName}
        status={<MappedStatusBadge status={detail.status} present={presentEnquiryStatus} />}
        meta={
          <>
            <MetaItem label="Topic">{topic}</MetaItem>
            <MetaItem label="Received">
              <StaffDate value={detail.createdAt} withTime />
            </MetaItem>
          </>
        }
        access={canWrite ? "full" : "read-only"}
        resource="enquiries"
        primaryAction={
          closed ? (
            <StaffButton
              variant="primary"
              requires="enquiry.write"
              icon={<RotateCcw aria-hidden />}
              loading={actions.pending}
              onClick={() => void actions.reopen(target)}
            >
              Reopen enquiry
            </StaffButton>
          ) : (
            <StaffButton
              variant="primary"
              requires="enquiry.write"
              icon={<CircleCheck aria-hidden />}
              loading={actions.pending}
              onClick={() => actions.requestClose(target)}
            >
              Close enquiry
            </StaffButton>
          )
        }
        notice={
          actions.conflict ? (
            <Notice
              tone="warning"
              alert
              title="This enquiry changed"
              actions={
                <StaffButton variant="secondary" size="sm" onClick={actions.reload}>
                  Reload enquiry
                </StaffButton>
              }
            >
              Someone else updated it while you had it open. Reload to see their change, then make
              yours again.
            </Notice>
          ) : null
        }
        rail={
          <>
            <Section title="Client">
              <KeyValueList
                items={[
                  ...(detail.sender.email
                    ? [
                        {
                          label: "Email",
                          value: (
                            <TextLink href={`mailto:${detail.sender.email}`}>
                              {detail.sender.email}
                            </TextLink>
                          ),
                          copyValue: detail.sender.email,
                        },
                      ]
                    : []),
                  ...(detail.sender.phone
                    ? [
                        {
                          label: "Phone",
                          value: (
                            <TextLink href={`tel:${detail.sender.phone.replace(/\s+/g, "")}`}>
                              {detail.sender.phone}
                            </TextLink>
                          ),
                        },
                      ]
                    : []),
                  {
                    label: "Account",
                    value: detail.sender.type === "member" ? "LAX Account member" : "Guest",
                  },
                ]}
              />
            </Section>

            {detail.artwork || pageLink ? (
              <Section title="About">
                <div className="flex flex-col gap-3">
                  {detail.artwork ? (
                    <>
                      {detail.artwork.thumbnailUrl ? (
                        <RecordImage src={detail.artwork.thumbnailUrl} alt={detail.artwork.title} />
                      ) : null}
                      <KeyValueList
                        items={[
                          {
                            label: "Artwork",
                            value: (
                              <TextLink href={`/artworks/${detail.artwork.id}`} Link={NextLink}>
                                {detail.artwork.title}
                              </TextLink>
                            ),
                          },
                          ...(artworkLink?.href
                            ? [
                                {
                                  label: "Public page",
                                  value: (
                                    <TextLink href={artworkLink.href} external>
                                      View on lax.art
                                    </TextLink>
                                  ),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </>
                  ) : null}
                  {pageLink ? (
                    <KeyValueList
                      items={[
                        {
                          label: pageLink.label,
                          value: pageLink.href ? (
                            <TextLink href={pageLink.href} external>
                              {pageLink.text}
                            </TextLink>
                          ) : (
                            pageLink.text
                          ),
                        },
                      ]}
                    />
                  ) : null}
                </div>
              </Section>
            ) : null}

            <Section title="Assignment">
              {canWrite ? (
                <div className="flex flex-col gap-3">
                  <Field label="Assigned to">
                    <EnumSelect
                      value={detail.assignee?.subject ?? UNASSIGNED}
                      options={assigneeOptions}
                      disabled={actions.pending}
                      onValueChange={(value) => {
                        if (value === (detail.assignee?.subject ?? UNASSIGNED)) return;
                        const person = staff.find((member) => member.subject === value) ?? null;
                        void actions.assign(
                          target,
                          value === UNASSIGNED ? null : person,
                          person ? enquiryStaffName(person) : "them",
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
                  items={[
                    {
                      label: "Assigned to",
                      value: detail.assignee ? enquiryStaffName(detail.assignee) : "Unassigned",
                    },
                  ]}
                />
              )}
            </Section>

            <Section title="Details">
              <KeyValueList
                items={[
                  ...(detail.closedAt
                    ? [
                        {
                          label: "Closed",
                          value: <StaffDate value={detail.closedAt} withTime />,
                        },
                      ]
                    : []),
                  { label: "Enquiry ID", value: detail.id, copyValue: detail.id },
                ]}
              />
            </Section>
          </>
        }
      >
        <Section title="Conversation">
          <ol aria-label="Messages and notes" className="flex flex-col gap-4">
            <li className="flex flex-col gap-2 rounded-staff-lg border border-staff-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-staff-sm font-medium text-staff-fg">{senderName}</p>
                <StaffDate value={detail.createdAt} withTime className="text-staff-xs" />
              </div>
              <p className="whitespace-pre-wrap text-staff-sm text-staff-fg">
                {detail.message || "No message was written."}
              </p>
            </li>
            {detail.notes.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-staff-lg border border-staff-line bg-staff-sunken p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-staff-sm font-medium text-staff-fg">
                    {enquiryStaffName(entry.author)}
                    <span className="ml-2 text-staff-xs font-normal text-staff-muted">
                      Internal note
                    </span>
                  </p>
                  <StaffDate value={entry.createdAt} withTime className="text-staff-xs" />
                </div>
                <p className="whitespace-pre-wrap text-staff-sm text-staff-fg">{entry.body}</p>
              </li>
            ))}
          </ol>
          {detail.notes.length === 0 ? (
            <EmptyState
              size="compact"
              headingLevel="h3"
              title="No notes yet"
              description="Notes you add are visible to staff only."
            />
          ) : null}
        </Section>

        {canWrite ? (
          <Section title="Add a note">
            <form
              noValidate
              onSubmit={(event) => void submit(event)}
              className="flex flex-col gap-4"
            >
              <FormErrorSummary
                errors={noteError ? [{ fieldId: NOTE_FIELD_ID, message: noteError }] : []}
                focusKey={failedSubmits}
              />
              <Field
                label="Note"
                id={NOTE_FIELD_ID}
                error={noteError}
                description={`Only staff see notes, and they cannot be edited or removed. The client is not emailed: reply from your own mailbox. ${note.length.toLocaleString("en-GB")} / ${ENQUIRY_NOTE_MAX_LENGTH.toLocaleString("en-GB")}`}
              >
                <TextArea
                  rows={4}
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    if (noteError) setNoteError(validate(event.target.value));
                  }}
                />
              </Field>
              <FormActions>
                <StaffButton type="submit" variant="secondary" loading={adding}>
                  Add note
                </StaffButton>
              </FormActions>
            </form>
          </Section>
        ) : null}
      </DetailPage>
      {actions.dialogs}
      <UnsavedChangesDialog guard={guard} />
    </>
  );
}
