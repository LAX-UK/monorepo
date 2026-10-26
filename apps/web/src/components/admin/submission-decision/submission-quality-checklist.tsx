"use client";

import { evaluateSubmissionQuality } from "@auction/domain";
import { Checklist, type StaffLinkComponent } from "@auction/staff-ui";
import type { ItemSubmission } from "@auction/types";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

type Props = {
  submission: Pick<
    ItemSubmission,
    "title" | "images" | "description" | "provenance" | "categoryId" | "categoryIds"
  >;
};

/** What the submission still needs before it can be accepted, and what would make it stronger. */
export function SubmissionQualityChecklist({ submission }: Props) {
  const { checks } = evaluateSubmissionQuality(submission);
  return (
    <Checklist
      title="Catalogue checks"
      description="Required items must be done to accept. The rest are recommended."
      Link={NextLink}
      items={checks.map((check) => ({
        id: check.id,
        label: check.label,
        done: check.ok,
        severity: check.severity === "required" ? ("required" as const) : ("recommended" as const),
      }))}
    />
  );
}
