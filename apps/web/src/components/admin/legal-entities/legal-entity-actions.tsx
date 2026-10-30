"use client";

import type { LegalEntitiesStaffRow } from "@/lib/admin/people/legal-entities-staff-list.vm";
import { redirectToHostedReauth } from "@/lib/auth/step-up/use-step-up-coordinator";
import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  KeyValueList,
  Notice,
  type OverflowAction,
  useStaffStepUp,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

/** The legal entity impersonation is started for: a list row or a record page. */
export type ImpersonationTarget = Pick<
  LegalEntitiesStaffRow,
  "id" | "name" | "kind" | "statusPresentation"
>;

/** What went wrong starting impersonation, in plain words. */
function impersonationFailure(result: { error: string; message?: string | undefined }): string {
  switch (result.error) {
    case "not_found":
      return "That legal entity could not be found. Refresh the list and try again.";
    case "forbidden":
    case "unauthorized":
      return "You do not have permission to impersonate legal entities.";
    default:
      return "Impersonation could not be started. Try again in a moment.";
  }
}

/**
 * Impersonation for a legal entity, from a row's `…` menu or the record panel. It opens a confirm
 * dialog that names the entity and says what impersonating means; when the API asks for a fresh
 * sign-in, the step-up dialog takes over. The API takes no reason for it, so none is asked for.
 */
export function useLegalEntityActions() {
  const router = useRouter();
  const [pending, setPendingState] = useState<ImpersonationTarget | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const stepUp = useStaffStepUp({ onReauthenticate: redirectToHostedReauth });

  const impersonate = useCallback((entity: ImpersonationTarget) => {
    setFailure(null);
    setPendingState(entity);
  }, []);
  const close = useCallback(() => {
    setFailure(null);
    setPendingState(null);
  }, []);

  const actionsFor = useCallback(
    (entity: ImpersonationTarget): OverflowAction[] => [
      {
        id: "impersonate",
        label: `Impersonate ${entity.name}`,
        onSelect: () => impersonate(entity),
      },
    ],
    [impersonate],
  );

  const start = (entity: ImpersonationTarget) => {
    setFailure(null);
    startTransition(async () => {
      const result = await startAdminImpersonationAfterLookup(entity.id);
      if (result.ok) {
        close();
        notify.success(`Impersonating ${entity.name}`);
        router.push("/home");
        router.refresh();
        return;
      }
      if (stepUp.handle(result, `impersonate ${entity.name}`)) {
        close();
        return;
      }
      // The dialog stays open, so the person can retry or cancel.
      setFailure(impersonationFailure(result));
    });
  };

  const dialogs = (
    <>
      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
        title={pending ? `Impersonate ${pending.name}?` : "Impersonate"}
        description="You will see and act as this legal entity for up to five hours. Everything you do is recorded in the audit log under your name. End impersonation from the banner at the top of the page."
        confirmLabel={pending ? `Impersonate ${pending.name}` : "Impersonate"}
        loading={busy}
        onConfirm={() => {
          if (pending) start(pending);
        }}
      >
        {pending ? (
          <>
            {failure ? (
              <Notice tone="danger" alert title="Impersonation did not start">
                {failure}
              </Notice>
            ) : null}
            <div className="rounded-staff-lg border border-staff-line px-3 py-1">
              <KeyValueList
                items={[
                  { label: "Legal entity", value: pending.name },
                  { label: "Kind", value: pending.kind },
                  { label: "Status", value: pending.statusPresentation.label },
                ]}
              />
            </div>
          </>
        ) : null}
      </ConfirmActionDialog>
      {stepUp.dialog}
    </>
  );

  return { actionsFor, impersonate, dialogs };
}
