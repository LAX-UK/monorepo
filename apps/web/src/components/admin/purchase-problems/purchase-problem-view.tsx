"use client";

import type { PurchaseProblemLinks } from "@/lib/admin/purchase-problems/purchase-problem-access";
import { purchaseProblemRecordActions } from "@/lib/admin/purchase-problems/purchase-problem-actions";
import { purchaseProblemTimeline } from "@/lib/admin/purchase-problems/purchase-problem-timeline";
import {
  PURCHASE_PROBLEMS_PATH,
  PURCHASE_PROBLEM_CATEGORY_LABELS,
} from "@/lib/admin/purchase-problems/purchase-problems.vm";
import type {
  PurchaseProblemAssignee,
  PurchaseProblemView as PurchaseProblemRecord,
} from "@/lib/data/http/admin-purchase-problems.schema";
import { copyToClipboard } from "@/lib/ui/copy-to-clipboard";
import { notify } from "@/lib/ui/notify";
import {
  DetailPage,
  MetaItem,
  Notice,
  OverflowMenu,
  Section,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  Timeline,
  formatStaffDateTime,
} from "@auction/staff-ui";
import { Copy, UserRoundPlus } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useState } from "react";
import { AssignPurchaseProblemDialog } from "./assign-purchase-problem-dialog";
import { PurchaseProblemStatusBadge } from "./purchase-problem-cells";
import {
  NotesSection,
  PurchaseSection,
  PutRightSection,
  ReportSection,
} from "./purchase-problem-sections";
import { ResolvePurchaseProblemDialog } from "./resolve-purchase-problem-dialog";
import { usePurchaseProblemWrites } from "./use-purchase-problem-writes";

const NextLink: StaffLinkComponent = Link;

export type PurchaseProblemViewProps = {
  problem: PurchaseProblemRecord;
  assignees: PurchaseProblemAssignee[];
  viewerId: string;
  links: PurchaseProblemLinks;
};

/**
 * One purchase problem on the staff record page: what the buyer reported, the purchase it is
 * about, who owns it, the internal notes and its history. Take on, assign and resolve sit in the
 * header and each states its effect. Resolving always records what was done.
 */
export function PurchaseProblemView({
  problem,
  assignees,
  viewerId,
  links,
}: PurchaseProblemViewProps) {
  const writes = usePurchaseProblemWrites(problem.id, problem.version);
  const actions = purchaseProblemRecordActions(problem);
  const [dialog, setDialog] = useState<"assign" | "resolve" | null>(null);

  const nameOf = (userId: string | null) =>
    userId ? assignees.find((person) => person.id === userId)?.name : undefined;
  const owner = nameOf(problem.assignedToUserId);
  const events = purchaseProblemTimeline(problem, nameOf);

  async function takeOn() {
    // Taking a report on makes it yours unless a colleague already has it.
    const result = await writes.patch({
      status: "in_progress",
      ...(problem.assignedToUserId ? {} : { assignedToUserId: viewerId }),
    });
    if (result.ok) notify.success(`${problem.reference} is in progress`);
    else notify.error(result.error);
  }

  const primary = actions.canStart ? (
    <StaffButton variant="primary" loading={writes.busy} onClick={() => void takeOn()}>
      Take on
    </StaffButton>
  ) : actions.canResolve ? (
    <StaffButton variant="primary" disabled={writes.busy} onClick={() => setDialog("resolve")}>
      Resolve…
    </StaffButton>
  ) : undefined;

  const secondary = (
    <>
      {actions.canStart && actions.canResolve ? (
        <StaffButton
          variant="secondary"
          disabled={writes.busy}
          onClick={() => setDialog("resolve")}
        >
          Resolve…
        </StaffButton>
      ) : null}
      {actions.canAssign ? (
        <StaffButton
          variant="secondary"
          icon={<UserRoundPlus aria-hidden />}
          onClick={() => setDialog("assign")}
        >
          {problem.assignedToUserId ? "Reassign" : "Assign"}
        </StaffButton>
      ) : null}
    </>
  );

  const notice =
    problem.status === "resolved" ? (
      <Notice tone="success" title="Resolved">
        {problem.resolvedAt ? `Resolved on ${formatStaffDateTime(problem.resolvedAt)}. ` : ""}
        What was done is in the notes. The buyer can report again if it comes back.
      </Notice>
    ) : undefined;

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[
              { label: "Purchase problems", href: PURCHASE_PROBLEMS_PATH },
              { label: problem.reference },
            ]}
          />
        }
        title={`${problem.buyerName} · ${PURCHASE_PROBLEM_CATEGORY_LABELS[problem.category]}`}
        status={<PurchaseProblemStatusBadge status={problem.status} />}
        meta={
          <>
            <MetaItem label="Reference">{problem.reference}</MetaItem>
            <MetaItem label="Raised">{formatStaffDateTime(problem.raisedAt)}</MetaItem>
            <MetaItem label="Owner">
              {owner ?? (problem.assignedToUserId ? "Former staff member" : "Nobody yet")}
            </MetaItem>
          </>
        }
        access="full"
        resource="Purchase problems"
        {...(primary ? { primaryAction: primary } : {})}
        secondaryActions={secondary}
        overflow={
          <OverflowMenu
            label="More purchase problem actions"
            Link={NextLink}
            actions={[
              {
                id: "copy-reference",
                label: "Copy reference",
                icon: Copy,
                onSelect: () => copyToClipboard(problem.reference, "Reference"),
              },
              { id: "back", label: "Back to the list", href: PURCHASE_PROBLEMS_PATH },
            ]}
          />
        }
        notice={notice}
        rail={<PurchaseSection problem={problem} links={links} />}
        railLabel="Purchase details"
      >
        <ReportSection problem={problem} />
        {problem.status === "resolved" ? null : <PutRightSection problem={problem} links={links} />}
        <NotesSection
          notes={problem.notes}
          nameOf={nameOf}
          editable={actions.canNote}
          add={(text) => writes.patch({ note: text })}
          onReload={writes.reload}
        />
        <Section
          id="history"
          title="History"
          description="What this record holds. Assignments and status changes are in the Audit log."
        >
          <Timeline label="Purchase problem history" events={events} />
        </Section>
      </DetailPage>
      <AssignPurchaseProblemDialog
        open={dialog === "assign"}
        onOpenChange={(open) => setDialog(open ? "assign" : null)}
        reference={problem.reference}
        assignedToUserId={problem.assignedToUserId}
        assignees={assignees}
        viewerId={viewerId}
        submit={writes.patch}
        onReload={writes.reload}
        onDone={(_, target) =>
          notify.success(
            target
              ? `${problem.reference} assigned to ${nameOf(target) ?? "a colleague"}`
              : `${problem.reference} is unassigned`,
          )
        }
      />
      <ResolvePurchaseProblemDialog
        open={dialog === "resolve"}
        onOpenChange={(open) => setDialog(open ? "resolve" : null)}
        reference={problem.reference}
        submit={writes.patch}
        onReload={writes.reload}
        onDone={() => notify.success(`${problem.reference} resolved`)}
      />
    </>
  );
}
