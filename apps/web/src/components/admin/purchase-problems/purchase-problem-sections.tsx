"use client";

import type { PurchaseProblemLinks } from "@/lib/admin/purchase-problems/purchase-problem-access";
import { validateNote } from "@/lib/admin/purchase-problems/purchase-problem-forms";
import {
  PURCHASE_PROBLEM_CATEGORY_LABELS,
  lotLabel,
  paymentStateLabel,
} from "@/lib/admin/purchase-problems/purchase-problems.vm";
import type {
  PurchaseProblemNote,
  PurchaseProblemView,
} from "@/lib/data/http/admin-purchase-problems.schema";
import { PURCHASE_PROBLEM_NOTE_MAX } from "@auction/domain";
import {
  Field,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  TextArea,
  UnsavedChangesDialog,
  formatStaffMoney,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { adminRoutes } from "@auction/types";
import Link from "next/link";
import { useId, useState } from "react";
import {
  type PurchaseProblemWriteFailure,
  PurchaseProblemWriteFailureNotice,
} from "./purchase-problem-write-failure";
import { type PurchaseProblemWriteResult, failureOf } from "./use-purchase-problem-writes";

const LINK_CLASS =
  "staff-focus rounded-staff-xs font-medium text-staff-fg underline underline-offset-2 decoration-staff-line-strong hover:decoration-staff-fg";

/** What the buyer reported: the reason they chose and their own words. */
export function ReportSection({ problem }: { problem: PurchaseProblemView }) {
  return (
    <Section id="report" title="What the buyer reported">
      <div className="flex flex-col gap-3">
        <KeyValueList
          items={[{ label: "Reason", value: PURCHASE_PROBLEM_CATEGORY_LABELS[problem.category] }]}
        />
        <p className="m-0 whitespace-pre-wrap break-words text-staff-sm leading-5 text-staff-fg">
          {problem.message}
        </p>
      </div>
    </Section>
  );
}

/** The purchase the report is about, with links to the pages staff put it right from. */
export function PurchaseSection({
  problem,
  links,
}: {
  problem: PurchaseProblemView;
  links: PurchaseProblemLinks;
}) {
  const lot = lotLabel(problem.lot);
  const lotName = [lot.secondary, lot.primary].filter(Boolean).join(" · ");
  return (
    <Section id="purchase" title="Purchase">
      <KeyValueList
        items={[
          {
            label: "Lot",
            value: links.lot ? (
              <Link href={adminRoutes.lot(problem.lot.id)} className={LINK_CLASS}>
                {lotName}
              </Link>
            ) : (
              lotName
            ),
          },
          ...(problem.lot.saleTitle
            ? [
                {
                  label: "Sale",
                  value: problem.lot.saleId ? (
                    <Link href={adminRoutes.sale.detail(problem.lot.saleId)} className={LINK_CLASS}>
                      {problem.lot.saleTitle}
                    </Link>
                  ) : (
                    problem.lot.saleTitle
                  ),
                },
              ]
            : []),
          { label: "Buyer", value: problem.buyerName },
          {
            label: "Amount",
            value: formatStaffMoney(problem.payment.amountMinor),
            numeric: true,
          },
          {
            label: "Payment",
            value: links.payment ? (
              <Link href={adminRoutes.payments.panel(problem.payment.id)} className={LINK_CLASS}>
                {paymentStateLabel(problem.payment.status)}
              </Link>
            ) : (
              paymentStateLabel(problem.payment.status)
            ),
          },
        ]}
      />
    </Section>
  );
}

/**
 * Where a report is put right. Each page makes its own change, so nothing here moves money:
 * the refund is made on the payment, and a delivery is arranged again on lot fulfilment.
 */
export function PutRightSection({
  problem,
  links,
}: {
  problem: PurchaseProblemView;
  links: PurchaseProblemLinks;
}) {
  const items: Array<{ id: string; href: string; label: string; hint: string }> = [
    ...(links.payment
      ? [
          {
            id: "refund",
            href: adminRoutes.payments.panel(problem.payment.id),
            label: "Open the payment",
            hint: "Refund the buyer from the payment.",
          },
        ]
      : []),
    ...(links.fulfilment
      ? [
          {
            id: "delivery",
            href: adminRoutes.lotFulfilment.list(),
            label: "Open lot fulfilment",
            hint: "Arrange delivery or collection again.",
          },
        ]
      : []),
  ];
  if (items.length === 0) return null;
  return (
    <Section
      id="put-right"
      title="Put it right"
      description="These open the page that makes the change. Come back and resolve the report with a note of what was done."
    >
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li key={item.id} className="text-staff-sm">
            <Link href={item.href} className={LINK_CLASS}>
              {item.label}
            </Link>
            <span className="text-staff-muted"> · {item.hint}</span>
          </li>
        ))}
      </ul>
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
  notes: readonly PurchaseProblemNote[];
  nameOf: (userId: string | null) => string | undefined;
  editable: boolean;
  add: (text: string) => Promise<PurchaseProblemWriteResult>;
  onReload: () => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<PurchaseProblemWriteFailure | null>(null);
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
    <Section id="notes" title="Notes" description="Internal. The buyer doesn't see notes.">
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
              <PurchaseProblemWriteFailureNotice
                failure={failure}
                title="The note wasn't added"
                onReload={onReload}
              />
            ) : null}
            <Field label="Add a note" id={fieldId} error={error ?? undefined} disabled={busy}>
              <TextArea
                rows={3}
                value={draft}
                maxLength={PURCHASE_PROBLEM_NOTE_MAX}
                placeholder="What was said or done, and what happens next"
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
