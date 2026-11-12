"use client";

import type {
  ReofferAction,
  ReofferActionId,
  ReofferCardModel,
} from "@/lib/admin/reoffer/reoffer-card.vm";
import { Notice, Section, StaffButton, StatusBadge, StepList } from "@auction/staff-ui";

type Props = {
  model: ReofferCardModel;
  onAction: (id: ReofferActionId) => void;
};

const VARIANT: Record<ReofferAction["variant"], "primary" | "secondary" | "danger-secondary"> = {
  primary: "primary",
  secondary: "secondary",
  danger: "danger-secondary",
};

/**
 * Where the lot stands after a buyer default: the offer's state, its four steps, who is next in
 * line, and the actions that fit. Everything it shows is decided by the model; it only draws it.
 */
export function ReofferCard({ model, onAction }: Props) {
  const { badge, position, steps, notice, actions, readOnlyNote } = model;
  return (
    <Section
      title="Re-offer"
      {...(badge ? { status: <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge> } : {})}
      {...(position
        ? { action: <span className="text-staff-xs text-staff-muted">{position}</span> }
        : {})}
    >
      <div className="flex flex-col gap-4">
        <StepList
          label="Re-offer steps"
          items={steps.map((step) => ({
            id: step.id,
            label: step.label,
            details: step.details,
            meta: step.when,
            state: step.state,
          }))}
        />
        {notice ? (
          <Notice tone="info" title={notice.title}>
            {notice.body}
          </Notice>
        ) : null}
        {actions.length > 0 ? (
          <div className="-mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-staff-line-subtle px-4 py-3">
            {actions.map((action) => (
              <StaffButton
                key={action.id}
                variant={VARIANT[action.variant]}
                onClick={() => onAction(action.id)}
              >
                {action.label}
              </StaffButton>
            ))}
          </div>
        ) : null}
        {readOnlyNote ? <p className="text-staff-sm text-staff-muted">{readOnlyNote}</p> : null}
      </div>
    </Section>
  );
}
