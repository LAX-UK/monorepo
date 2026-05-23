import { CatalogDetailTabPanel } from "@/components/admin/catalog";
import type { ReactNode } from "react";

type Props = {
  decision: ReactNode;
};

export function SubmissionDecisionTab({ decision }: Props) {
  return (
    <CatalogDetailTabPanel
      title="Decision"
      description="Approve to create a draft lot or reject with a clear reason for the seller."
      framed={false}
    >
      {decision}
    </CatalogDetailTabPanel>
  );
}
