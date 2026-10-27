"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { EmptyState, Section, StaffButton } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  legalEntities?: Pick<LegalEntity, "id" | "displayName">[];
};

const IMPERSONATION_FAILURES: Record<string, string> = {
  not_found: "That seller organisation no longer exists.",
  bad_request: "That seller organisation could not be found.",
};

/**
 * The side column of a client's page: the seller organisations staff can impersonate to see LAX
 * as that seller does.
 */
export function UserDetailContextRail({ legalEntities = [] }: Props) {
  const router = useRouter();
  const confirm = useStaffConfirm();

  const impersonate = (entity: Pick<LegalEntity, "id" | "displayName">) =>
    confirm.ask({
      title: `Impersonate ${entity.displayName}?`,
      description:
        "You will use LAX as this seller organisation until you stop impersonating. Do it only to help the client.",
      confirmLabel: "Impersonate",
      stepUpAction: "impersonate a seller",
      run: async () => {
        const result = await startAdminImpersonationAfterLookup(entity.id);
        if (result.ok) return { ok: true };
        return {
          ok: false,
          error:
            result.message ??
            IMPERSONATION_FAILURES[result.error] ??
            "Impersonation could not start. Try again.",
          errorCode: result.error,
        };
      },
      success: "Impersonation started",
      onSuccess: () => {
        router.push("/home");
        router.refresh();
      },
    });

  return (
    <>
      <Section
        title="Seller organisations"
        description="Impersonate one to see LAX as that seller does."
        bodyClassName="p-0"
      >
        {legalEntities.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            title="No seller organisations"
            description="This client has not created one, so there is nothing to impersonate."
          />
        ) : (
          <ul className="divide-y divide-staff-line-subtle">
            {legalEntities.map((entity) => (
              <li
                key={entity.id}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-2"
              >
                <Link
                  href={`/admin/legal-entities/${encodeURIComponent(entity.id)}`}
                  className="staff-focus min-w-0 break-words rounded-staff-xs text-staff-sm font-medium text-staff-fg underline underline-offset-2"
                >
                  {entity.displayName}
                </Link>
                <StaffButton size="sm" variant="secondary" onClick={() => impersonate(entity)}>
                  Impersonate
                </StaffButton>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {confirm.dialog}
    </>
  );
}
