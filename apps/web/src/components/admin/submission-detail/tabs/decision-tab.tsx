import type { ReactNode } from "react";

type Props = {
  decision: ReactNode;
};

/** The decision tab: approve to create a draft lot, or reject with a reason the seller reads. */
export function SubmissionDecisionTab({ decision }: Props) {
  return <>{decision}</>;
}
