import { AdminStaffLabeledField } from "@/components/admin/admin-staff-labeled-field";
import { AdminStripeConnectActions } from "@/components/admin/admin-stripe-connect-actions";
import { AdminTechnicalIdDisclosure } from "@/components/admin/admin-technical-id-disclosure";
import { DetailBoardShell } from "@/components/admin/catalog/detail-board";
import {
  collectStripeTechnicalIds,
  presentStripeConnectAccount,
  presentStripeDisabledReason,
  presentStripeRequirementsForEntity,
} from "@/lib/admin/stripe-connect-staff-presenter";
import type { LegalEntity } from "@auction/types";

type Props = {
  entity: LegalEntity;
};

export function LegalEntityStripeTab({ entity }: Props) {
  const stripeAccount = presentStripeConnectAccount(entity.stripeConnectAccountId);
  const disabledReasonRef = presentStripeDisabledReason(entity.stripeConnectDisabledReason);
  const stripeRequirementItems = presentStripeRequirementsForEntity(entity);
  const stripeTechnicalIds = collectStripeTechnicalIds(entity);

  return (
    <div className="space-y-6">
      <DetailBoardShell
        title="Stripe Connect"
        description="Account status, capability flags, and outstanding requirements."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-on-surface-variant">Connect account</dt>
            <dd className="text-on-surface">
              {stripeAccount ? (
                <AdminStaffLabeledField
                  primary={stripeAccount.primary}
                  {...(stripeAccount.secondary ? { secondary: stripeAccount.secondary } : {})}
                />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-on-surface-variant">Charges enabled</dt>
            <dd className="text-on-surface">{entity.stripeConnectChargesEnabled ? "Yes" : "No"}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-on-surface-variant">Payouts enabled</dt>
            <dd className="text-on-surface">{entity.stripeConnectPayoutsEnabled ? "Yes" : "No"}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-on-surface-variant">Disabled reason</dt>
            <dd className="text-on-surface">
              {disabledReasonRef ? (
                <AdminStaffLabeledField
                  primary={disabledReasonRef.primary}
                  {...(disabledReasonRef.secondary
                    ? { secondary: disabledReasonRef.secondary }
                    : {})}
                />
              ) : (
                "None"
              )}
            </dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-on-surface-variant">Currently due requirements</dt>
            <dd className="text-on-surface">
              {stripeRequirementItems.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {stripeRequirementItems.map((label) => (
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
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-6 space-y-4 border-t border-shell-stroke pt-6">
          <AdminStripeConnectActions entity={entity} />
          <AdminTechnicalIdDisclosure items={stripeTechnicalIds} />
        </div>
      </DetailBoardShell>
    </div>
  );
}
