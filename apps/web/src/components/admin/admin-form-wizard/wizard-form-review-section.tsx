"use client";

import { type KeyValueItem, ReviewSection } from "@auction/staff-ui";
import { Children, type ReactElement, type ReactNode, isValidElement } from "react";

type RowProps = { label: string; value: string };

/** One answer on a review step; read by {@link WizardFormReviewSection}. */
export function WizardReviewRow(_props: RowProps): null {
  return null;
}

type SectionProps = {
  title: string;
  onEdit: () => void;
  children: ReactNode;
};

/** One step's answers on a review step, on the kit review section, with Change. */
export function WizardFormReviewSection({ title, onEdit, children }: SectionProps) {
  const items: KeyValueItem[] = Children.toArray(children)
    .filter((child): child is ReactElement<RowProps> => isValidElement(child))
    .map((child) => ({ label: child.props.label, value: child.props.value || null }));
  return <ReviewSection title={title} items={items} onChange={onEdit} />;
}
