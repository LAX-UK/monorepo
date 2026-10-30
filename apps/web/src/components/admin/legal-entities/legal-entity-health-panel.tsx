import type { LegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import { KeyValueList, Section, StatusBadge } from "@auction/staff-ui";

type Props = {
  health: LegalEntityHealthVM;
};

/** Whether the organisation can sell and be paid yet, and what still stands in the way. */
export function LegalEntityHealthPanel({ health }: Props) {
  return (
    <Section
      title="Organisation readiness"
      description="Connect stage and commerce gates for this legal entity."
    >
      <div className="flex flex-col gap-4">
        <KeyValueList
          items={[
            { label: "Connect stage", value: health.stageLabel },
            {
              label: "Can sell",
              value: (
                <StatusBadge tone={health.canPublish ? "success" : "warning"}>
                  {health.canPublish ? "Ready to publish lots" : "Not ready to sell"}
                </StatusBadge>
              ),
            },
            {
              label: "Can get paid",
              value: (
                <StatusBadge tone={health.canReceivePayouts ? "success" : "warning"}>
                  {health.canReceivePayouts ? "Payouts enabled" : "Payout setup incomplete"}
                </StatusBadge>
              ),
            },
          ]}
        />
        {health.blockers.length > 0 ? (
          <ul className="flex flex-col divide-y divide-staff-line-subtle rounded-staff-lg border border-staff-line">
            {health.blockers.map((blocker) => (
              <li key={blocker.key} className="flex flex-col gap-0.5 px-3 py-2 text-staff-sm">
                <span className="font-medium text-staff-fg">{blocker.label}</span>
                <span className="text-staff-muted">{blocker.hint}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-staff-sm text-staff-muted">
            No outstanding blockers. This organisation is ready for commerce.
          </p>
        )}
      </div>
    </Section>
  );
}
