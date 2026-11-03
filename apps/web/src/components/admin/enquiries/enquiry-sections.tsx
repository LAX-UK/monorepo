"use client";

import {
  ENQUIRY_BUDGET_LABELS,
  ENQUIRY_CONTACT_LABELS,
  ENQUIRY_TIMING_LABELS,
} from "@/lib/admin/enquiries/enquiries.vm";
import { NOTE_MAX_LENGTH, validateNote } from "@/lib/admin/enquiries/enquiry-forms";
import { attachmentSummary } from "@/lib/admin/enquiries/enquiry-timeline";
import type { EnquiryNote, EnquiryView } from "@/lib/data/http/admin-enquiries.schema";
import {
  Field,
  type KeyValueItem,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  TextArea,
  UnsavedChangesDialog,
  formatStaffMoney,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { useId, useState } from "react";
import { EnquiryWriteFailureNotice } from "./enquiry-write-failure";
import type { EnquiryWriteFailure } from "./enquiry-write-failure";
import { type EnquiryWriteResult, failureOf } from "./use-enquiry-writes";

/** What the client told us about the work or what they want, as the enquiry page asked it. */
export function privateSaleItems(enquiry: EnquiryView): KeyValueItem[] {
  const detail = enquiry.privateSale;
  if (!detail) return [];
  if (enquiry.intent === "private_sale_buy") {
    return [
      ...(detail.lookingFor ? [{ label: "Looking for", value: detail.lookingFor }] : []),
      ...(detail.budgetBand
        ? [{ label: "Budget", value: ENQUIRY_BUDGET_LABELS[detail.budgetBand] }]
        : []),
      ...(detail.timing ? [{ label: "Timing", value: ENQUIRY_TIMING_LABELS[detail.timing] }] : []),
    ];
  }
  const work = [detail.artist, detail.title].filter(Boolean).join(", ");
  const place = [detail.locationTown, detail.locationCountry].filter(Boolean).join(", ");
  const files = attachmentSummary(enquiry.attachments);
  return [
    ...(work ? [{ label: "Work", value: work }] : []),
    ...(detail.medium ? [{ label: "Medium", value: detail.medium }] : []),
    ...(detail.size ? [{ label: "Size", value: detail.size }] : []),
    ...(place ? [{ label: "Location", value: place }] : []),
    ...(detail.priceInMindMinor !== null
      ? [
          {
            label: "Price in mind",
            value: formatStaffMoney(detail.priceInMindMinor),
            numeric: true,
          },
        ]
      : []),
    ...(files ? [{ label: "Attachments", value: `${files} received` }] : []),
  ];
}

/** The typed private sale answers: the work for a seller, the brief for a buyer. */
export function PrivateSaleSection({ enquiry }: { enquiry: EnquiryView }) {
  const items = privateSaleItems(enquiry);
  if (items.length === 0) return null;
  return (
    <Section
      id="detail"
      title={enquiry.intent === "private_sale_buy" ? "What they're looking for" : "The work"}
    >
      <KeyValueList items={items} />
    </Section>
  );
}

export function MessageSection({ message }: { message: string }) {
  return (
    <Section id="message" title="Message">
      {message.trim() ? (
        <p className="m-0 whitespace-pre-wrap break-words text-staff-sm leading-5 text-staff-fg">
          {message}
        </p>
      ) : (
        <p className="m-0 text-staff-sm text-staff-muted">The client didn't add a message.</p>
      )}
    </Section>
  );
}

/** The sender, in full: this is the one place the email is not masked. */
export function ClientSection({ enquiry }: { enquiry: EnquiryView }) {
  const contact = enquiry.privateSale?.contactPreference;
  return (
    <Section id="client" title="Client">
      <KeyValueList
        items={[
          { label: "Name", value: enquiry.name },
          {
            label: "Email",
            value: <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>,
            copyValue: enquiry.email,
          },
          ...(enquiry.phone
            ? [{ label: "Phone", value: enquiry.phone, copyValue: enquiry.phone }]
            : []),
          {
            label: "Account",
            value: enquiry.userId ? (
              <>
                LAX account
                <span className="block text-staff-muted">Signed in when they sent it</span>
              </>
            ) : (
              <>
                Guest
                <span className="block text-staff-muted">Sent without signing in</span>
              </>
            ),
          },
          ...(contact ? [{ label: "Prefers", value: ENQUIRY_CONTACT_LABELS[contact] }] : []),
          { label: "Marketing", value: enquiry.marketingOptIn ? "Opted in" : "Not opted in" },
          ...(enquiry.sourcePage ? [{ label: "Sent from", value: enquiry.sourcePage }] : []),
        ]}
      />
    </Section>
  );
}

/** Internal notes, newest last, with a box to add one. */
export function NotesSection({
  notes,
  nameOf,
  editable,
  add,
  onReload,
}: {
  notes: readonly EnquiryNote[];
  nameOf: (userId: string | null) => string | undefined;
  editable: boolean;
  add: (text: string) => Promise<EnquiryWriteResult>;
  onReload: () => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<EnquiryWriteFailure | null>(null);
  const guard = useUnsavedChanges(draft.trim().length > 0, {
    label: "the note",
    interceptBack: false,
  });

  async function submit() {
    const problem = validateNote(draft);
    setError(problem);
    if (problem) return;
    setBusy(true);
    setFailure(null);
    const result = await add(draft.trim());
    setBusy(false);
    if (result.ok) setDraft("");
    else setFailure(failureOf(result));
  }

  return (
    <Section
      id="notes"
      title="Notes"
      description="Internal. Don't paste the client's personal details."
    >
      <div className="flex flex-col gap-4">
        {notes.length === 0 ? (
          <p className="m-0 text-staff-sm text-staff-muted">No notes have been added.</p>
        ) : (
          <ul aria-label="Notes" className="m-0 flex list-none flex-col gap-3 p-0">
            {notes.map((note) => (
              <li key={note.id} className="rounded-staff-md bg-staff-sunken px-3 py-2.5">
                <p className="m-0 text-staff-xs text-staff-muted">
                  <span className="font-medium text-staff-fg">
                    {nameOf(note.authorUserId) ?? "Former staff member"}
                  </span>{" "}
                  · <StaffDate value={note.createdAt} withTime />
                </p>
                <p className="m-0 mt-1 whitespace-pre-wrap break-words text-staff-sm leading-5 text-staff-fg">
                  {note.body}
                </p>
              </li>
            ))}
          </ul>
        )}
        {editable ? (
          <div className="flex flex-col gap-3">
            {failure ? (
              <EnquiryWriteFailureNotice
                failure={failure}
                title="The note wasn't added"
                onReload={onReload}
              />
            ) : null}
            <Field label="Add a note" id={fieldId} error={error ?? undefined} disabled={busy}>
              <TextArea
                rows={3}
                value={draft}
                maxLength={NOTE_MAX_LENGTH}
                placeholder="What was said, and what happens next"
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError(null);
                }}
              />
            </Field>
            <div>
              <StaffButton
                variant="secondary"
                size="sm"
                loading={busy}
                onClick={() => void submit()}
              >
                Add note
              </StaffButton>
            </div>
          </div>
        ) : null}
      </div>
      <UnsavedChangesDialog guard={guard} />
    </Section>
  );
}
