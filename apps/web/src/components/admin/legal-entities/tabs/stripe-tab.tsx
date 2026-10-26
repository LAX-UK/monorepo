import { AdminStaffLabeledField } from "@/components/admin/admin-staff-labeled-field";
import { AdminStripeConnectActions } from "@/components/admin/admin-stripe-connect-actions";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import {
  collectStripeTechnicalIds,
  presentStripeConnectAccount,
  presentStripeDisabledReason,
  presentStripeRequirementsForEntity,
} from "@/lib/admin/stripe-connect-staff-presenter";
import { KeyValueList, Section } from "@auction/staff-ui";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
};

/** Stripe Connect status for the organisation, what is still due, and the support tools. */
export function LegalEntityStripeTab({ entity }: Props) {
  const stripeAccount = presentStripeConnectAccount(entity.stripeConnectAccountId);
  const disabledReason = presentStripeDisabledReason(entity.stripeConnectDisabledReason);
  const requirements = presentStripeRequirementsForEntity(entity);
  const technicalIds = collectStripeTechnicalIds(entity);

  return (
    <>
      <Section
        title="Stripe Connect"
        description="Account status, capability flags and outstanding requirements."
      >
        <KeyValueList
          items={[
            {
              label: "Connect account",
              value: stripeAccount ? (
                <AdminStaffLabeledField
                  primary={stripeAccount.primary}
                  {...(stripeAccount.secondary ? { secondary: stripeAccount.secondary } : {})}
                />
              ) : null,
            },
            { label: "Charges enabled", value: entity.stripeConnectChargesEnabled ? "Yes" : "No" },
            { label: "Payouts enabled", value: entity.stripeConnectPayoutsEnabled ? "Yes" : "No" },
            {
              label: "Disabled reason",
              value: disabledReason ? (
                <AdminStaffLabeledField
                  primary={disabledReason.primary}
                  {...(disabledReason.secondary ? { secondary: disabledReason.secondary } : {})}
                />
              ) : (
                "None"
              ),
            },
            {
              label: "Currently due",
              value:
                requirements.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {requirements.map((label) => (
                      <li key={label.technicalValue ?? label.primary}>
                        <AdminStaffLabeledField
                          primary={label.primary}
                          {...(label.secondary ? { secondary: label.secondary } : {})}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  "None outstanding"
                ),
            },
          ]}
        />
      </Section>
      <Section title="Support tools">
        <div className="flex flex-col gap-4">
          <AdminStripeConnectActions entity={entity} />
          <AdminTechnicalIdDisclosure items={technicalIds} />
        </div>
      </Section>
    </>
  );
}
