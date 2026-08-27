"use client";

import type { ConditionReportRequestPort } from "@/lib/condition-report/condition-report-request.port";
import type { ConditionReportRequestSnapshot } from "@/lib/condition-report/condition-report-types";
import { submitConditionReportRequest } from "@/lib/data/http/condition-report.client";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const defaultPort: ConditionReportRequestPort = {
  getForLot: async () => null,
  submit: submitConditionReportRequest,
};

export function useConditionReportRequest(
  lotId: string,
  port: ConditionReportRequestPort = defaultPort,
) {
  const router = useRouter();
  const [uiPhase, setUiPhase] = useState<"idle" | "submitting" | "submitError">("idle");
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  const submit = useCallback(
    async (requestNote: string): Promise<ConditionReportRequestSnapshot | null> => {
      setUiPhase("submitting");
      setSubmitErrorMessage(null);
      const result = await port.submit(lotId, requestNote);
      if (!result.ok) {
        setSubmitErrorMessage(result.message);
        setUiPhase("submitError");
        return null;
      }
      setUiPhase("idle");
      notify.success("Request submitted", {
        description:
          "We'll notify you when your specialist report is ready. Track it in Condition reports.",
      });
      router.refresh();
      return result.row;
    },
    [lotId, port, router],
  );

  return {
    uiPhase,
    submitErrorMessage,
    submit,
  };
}
