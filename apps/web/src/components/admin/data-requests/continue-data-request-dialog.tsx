"use client";

import { PRODUCT_LABELS, formatDay } from "@/lib/admin/data-requests/data-requests.vm";
import type {
  DataRequestProduct,
  DownloadRequestView,
} from "@auction/identity-contracts/data-requests";
import { StaffButton, StaffDialog } from "@auction/staff-ui";
import { ArrowRight, Check, Plus } from "@auction/staff-ui/icons";
import { useRef, useState } from "react";
import { DataRequestWriteFailure } from "./data-request-write-failure";
import type { WriteFailure, WriteResult } from "./use-data-request-writes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: Pick<DownloadRequestView, "reference" | "requestedOn" | "dueOn" | "products">;
  /** The products the download already collected. */
  collected: readonly DataRequestProduct[];
  submit: () => Promise<WriteResult>;
  onReload: () => void;
  onDone: (reference: string) => void;
};

function Effect({
  icon,
  title,
  children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-staff-muted"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col text-staff-sm">
        <span className="font-medium text-staff-fg">{title}</span>
        <span className="text-staff-muted">{children}</span>
      </span>
    </li>
  );
}

/**
 * Takes over a delayed or failed download by hand. It says what will be created, which products
 * carry over and that the original dates stay, so the person's clock never resets.
 */
export function ContinueDataRequestDialog({
  open,
  onOpenChange,
  request,
  collected,
  submit,
  onReload,
  onDone,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<WriteFailure | null>(null);
  const products = request.products.map((product) => PRODUCT_LABELS[product]);

  async function proceed() {
    setFailure(null);
    setBusy(true);
    const result = await submit();
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(result.data.request.reference);
    } else if (!result.ok) {
      setFailure({ message: result.error, stale: result.errorCode === "stale_version" });
    }
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      initialFocusRef={cancelRef}
      title={`Continue ${request.reference} manually?`}
      description="A manual request is created and linked. The person keeps the same due date."
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            loading={busy}
            icon={<ArrowRight aria-hidden />}
            onClick={() => void proceed()}
          >
            Continue manually
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <DataRequestWriteFailure
            failure={failure}
            title="The request couldn't be continued"
            onReload={onReload}
          />
        ) : null}
        <ul className="flex flex-col gap-3">
          <Effect icon={<Plus className="size-4" />} title="A new manual request">
            Full copy · received {formatDay(request.requestedOn)}
            {request.dueOn ? ` · due ${formatDay(request.dueOn)}` : ""} · {products.join(", ")}
          </Effect>
          {collected.length > 0 ? (
            <Effect
              icon={<Check className="size-4" />}
              title={`${collected.map((product) => PRODUCT_LABELS[product]).join(" and ")} already collected`}
            >
              Marked gathered on the new request.
            </Effect>
          ) : null}
          <Effect
            icon={<ArrowRight className="size-4" />}
            title={`${request.reference} leaves the Open view`}
          >
            It shows as continued manually. The person's LAX Account page keeps saying it's taking
            longer, with the same date.
          </Effect>
        </ul>
        <p className="text-staff-sm text-staff-muted">A download can be continued only once.</p>
      </div>
    </StaffDialog>
  );
}
