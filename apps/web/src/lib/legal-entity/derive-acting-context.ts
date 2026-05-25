import type { ActingContext } from "@/lib/auth/capabilities";
import type { LegalEntitySummary } from "@auction/types";

export type DeriveActingContextInput = {
  actingContext: {
    acting: LegalEntitySummary | null;
    impersonation: { displayName: string } | null;
  };
  orgModuleEnabled: boolean;
};

export type DeriveActingContextResult = {
  acting: ActingContext;
  /** Acting entity for banner/capability wiring; null when org module hides org context. */
  safeActing: LegalEntitySummary | null;
};

/** Derives shell acting context, neutralising org acting when the org module is disabled. */
export function deriveActingContext({
  actingContext,
  orgModuleEnabled,
}: DeriveActingContextInput): DeriveActingContextResult {
  const orgGated = orgModuleEnabled === false;
  const safeActing =
    orgGated && actingContext.acting?.kind === "organisation" ? null : actingContext.acting;

  const acting: ActingContext =
    actingContext.impersonation && actingContext.acting
      ? {
          kind: "impersonating",
          userId: actingContext.acting.id,
          userName: actingContext.impersonation.displayName,
        }
      : safeActing?.kind === "organisation"
        ? {
            kind: "organisation",
            orgId: safeActing.id,
            orgName: safeActing.displayName,
          }
        : { kind: "self" };

  return { acting, safeActing };
}
