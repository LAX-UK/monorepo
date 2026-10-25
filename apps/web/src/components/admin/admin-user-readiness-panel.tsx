import type { AdminUserReadinessSnapshot } from "@/lib/admin/admin-user-readiness.vm";
import { staffIdentityStatus, staffStatus } from "@/lib/admin/staff-kit-status";
import {
  type KeyValueItem,
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";

const NEXT_STEP_TONE = { ready: "success", warning: "warning", blocked: "danger" } as const;

/**
 * Whether this client is ready to bid and buy: the next step first, then the identity,
 * compliance and selling facts it rests on.
 */
export function AdminUserReadinessPanel({ snapshot }: { snapshot: AdminUserReadinessSnapshot }) {
  const { identity, compliance, commerce, nextAction } = snapshot;
  const identityStatus = staffIdentityStatus(identity.kycStatus);
  const amlDecision = compliance.latestAmlDecision
    ? staffStatus("amlDecision", compliance.latestAmlDecision)
    : null;

  const items: KeyValueItem[] = [
    { label: "Email", value: identity.emailVerified ? "Verified" : "Not verified" },
    {
      label: "Identity",
      value: <StatusBadge tone={identityStatus.tone}>{identityStatus.label}</StatusBadge>,
    },
    {
      label: "Two-step",
      value: identity.securityStatusAvailable
        ? identity.twoFactorEnabled
          ? "On"
          : "Off"
        : "Unavailable",
    },
    {
      label: "AML hold",
      value: compliance.amlHoldActive ? <StatusBadge tone="danger">On hold</StatusBadge> : "None",
    },
    {
      label: "AML review",
      value: compliance.amlReviewPending ? "Awaiting review" : "None pending",
    },
    {
      label: "Latest AML decision",
      value: amlDecision ? (
        <StatusBadge tone={amlDecision.tone}>{amlDecision.label}</StatusBadge>
      ) : null,
    },
    { label: "Legal entities", value: String(commerce.legalEntityCount), numeric: true },
    {
      label: "Seller setup",
      value:
        commerce.connectGapsCount > 0
          ? `${commerce.connectGapsCount} ${commerce.connectGapsCount === 1 ? "entity" : "entities"} incomplete`
          : "Complete",
    },
    { label: "Lots won", value: String(commerce.lotsWon), numeric: true },
    { label: "Lifetime spend", value: commerce.lifetimeSpendLabel, numeric: true },
  ];

  return (
    <Section
      id="readiness"
      title="Readiness"
      description="Identity, compliance and selling status for this client."
      className="scroll-mt-20"
    >
      <div className="flex flex-col gap-4">
        <Notice
          tone={NEXT_STEP_TONE[nextAction.tone]}
          title={nextAction.label}
          actions={
            nextAction.tone === "ready" ? null : (
              <StaffButton asChild size="sm" variant="secondary">
                <Link href={nextAction.href}>Review</Link>
              </StaffButton>
            )
          }
        />
        <KeyValueList items={items} columns={2} />
      </div>
    </Section>
  );
}
