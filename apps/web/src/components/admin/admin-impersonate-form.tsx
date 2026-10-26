"use client";

import { searchLegalEntityOptions } from "@/lib/admin/pickers/staff-entity-search";
import { handleStaffStepUp } from "@/lib/auth/step-up/staff-step-up.client";
import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import {
  ConfirmActionDialog,
  type EntityOption,
  EntityPicker,
  Field,
  FormActions,
  FormSection,
  Notice,
  StaffButton,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** What went wrong, in words a staff member can act on. */
export function impersonationErrorMessage(result: { error: string; message?: string }): string {
  switch (result.error) {
    case "not_found":
      return "That legal entity no longer exists. Choose another.";
    case "not_impersonation":
      return "You are already a member of that entity. Switch to it from your account instead.";
    case "bad_request":
      return "Choose a legal entity from the search results.";
    case "unauthorized":
      return "Your sign-in has expired. Sign out, sign in again and retry.";
    case "forbidden":
      return "Support sessions are limited to staff with full platform admin access.";
    case "network":
      return "Bid could not reach the server. Check your connection and retry.";
    default:
      return result.message
        ? `The support session did not start: ${result.message}`
        : "The support session did not start. Try again.";
  }
}

/**
 * Start a support session as a legal entity: choose it by name, then confirm. The confirm says
 * that the entity's owners and admins are told and that the session ends after four hours. A
 * failure stays on the form; a fresh sign-in is asked for when the API wants one.
 */
export function AdminImpersonateForm({
  searchEntities = searchLegalEntityOptions,
}: {
  searchEntities?: (query: string) => Promise<readonly EntityOption[]>;
}) {
  const router = useRouter();
  const [entity, setEntity] = useState<EntityOption | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () => {
    if (!entity) return;
    setFailure(null);
    startTransition(async () => {
      const result = await startAdminImpersonationAfterLookup(entity.id);
      if (!result.ok) {
        setConfirming(false);
        if (handleStaffStepUp(result)) return;
        setFailure(impersonationErrorMessage(result));
        return;
      }
      notify.success(`Support session started as ${entity.label}`);
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!entity) {
          setMissing(true);
          return;
        }
        setConfirming(true);
      }}
    >
      {failure ? (
        <Notice tone="danger" alert title="The support session did not start">
          {failure}
        </Notice>
      ) : null}
      <FormSection
        title="Legal entity"
        description="You see Bid as its members do, and can act for it."
      >
        <Field
          label="Legal entity"
          id="impersonate-legal-entity"
          description="Search by organisation or entity name."
          error={missing && !entity ? "Choose the legal entity to support." : null}
        >
          <EntityPicker
            id="impersonate-legal-entity"
            value={entity?.id ?? null}
            selected={entity}
            onValueChange={(option) => {
              setEntity(option);
              setFailure(null);
            }}
            search={searchEntities}
            placeholder="Choose a legal entity"
            searchPlaceholder="Search legal entities"
            emptyText="No legal entity matches"
            disabled={pending}
            invalid={missing && !entity}
          />
        </Field>
      </FormSection>
      <FormActions>
        <StaffButton type="submit" variant="primary" loading={pending}>
          Start support session
        </StaffButton>
      </FormActions>
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!pending) setConfirming(open);
        }}
        title={`Start a support session as ${entity?.label ?? "this entity"}?`}
        description="Its owners and admins are emailed that staff are acting for them. The session ends after four hours, or when you end it from the banner."
        confirmLabel="Start support session"
        loading={pending}
        onConfirm={start}
      />
    </form>
  );
}
