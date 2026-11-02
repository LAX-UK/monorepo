import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type Fact = {
  label: string;
  value: ReactNode;
};

type Props = {
  facts: readonly Fact[];
  className?: string;
  /** Classes for the div that holds one term and its value. */
  factClassName?: string;
  termClassName?: string;
  valueClassName?: string;
};

/**
 * Labelled facts as a description list: `dl > div > dt + dd`, the only grouping a list of terms
 * allows. Lot facts, sale details and fees use it, so a screen reader announces each pair.
 */
export function FactList({
  facts,
  className,
  factClassName,
  termClassName,
  valueClassName,
}: Props) {
  return (
    <dl className={className}>
      {facts.map((fact) => (
        <div key={fact.label} className={factClassName}>
          <dt className={cn("text-lax-12 text-lax-muted", termClassName)}>{fact.label}</dt>
          <dd className={cn("text-lax-14 text-lax-fg", valueClassName)}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
