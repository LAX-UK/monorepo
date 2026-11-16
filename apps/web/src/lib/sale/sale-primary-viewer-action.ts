import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { contextualIdentityOnboardingHref } from "@/lib/kyc/identity-onboarding";
import { kycLinkActionLabel } from "@/lib/kyc/kyc-link-action-copy";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { saleLifecycleActions } from "@/lib/sale/sale-lifecycle-actions";
import type { LegalEntityMemberRole, SaleDeliveryMode } from "@auction/types";

/*
 * The one thing a sale page asks the person looking at it to do next, for a sale people bid on
 * online. The hero's action row and the phone bottom bar both draw it from here, so the two can
 * never offer different things: what the hero shows, the bar shows once the hero scrolls away.
 * `null` means there is nothing to ask (registered already, a private collector who needs no
 * registration, a sale that takes no web registrations, or one that has closed); each surface then
 * shows its own quiet default (the bar offers the lots).
 */

export type SalePrimaryViewerAction = {
  label: string;
  href: string;
  /** A signed-out visitor's sign-up is the page's main button; a signed-in step is a quieter one. */
  emphasis: "primary" | "secondary";
};

export type RegisterToBidActionInput = {
  /** Where sign-up and identity checks bring the person back to: the sale page. */
  saleHref: string;
  isAuthenticated: boolean;
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
  buyerEntities: readonly { memberRole: LegalEntityMemberRole }[];
  orgModuleEnabled?: boolean;
};

export type SalePrimaryViewerActionInput = RegisterToBidActionInput & {
  status: "draft" | "scheduled" | "active" | "ended" | "cancelled" | "voided";
  deliveryMode: SaleDeliveryMode;
  /**
   * The sale takes web registrations and this person may take part in it (not staff, not an
   * externally run catalogue).
   */
  registrationOffered: boolean;
  /** From `SaleViewerVM.hasApprovedRegistration`: the one place "registered" is decided. */
  hasApprovedRegistration: boolean;
};

/** The register step for someone who is not registered yet, by where they stand. */
export function registerToBidAction(
  input: RegisterToBidActionInput,
): SalePrimaryViewerAction | null {
  if (!input.isAuthenticated) {
    return {
      label: "Register to bid",
      href: buildHostedLoginStartHref({ next: input.saleHref, intent: "signup" }),
      emphasis: "primary",
    };
  }
  if (!input.kycApproved) {
    return {
      label: input.kycFeedback
        ? kycLinkActionLabel(input.kycFeedback, "long")
        : "Verify identity to bid",
      href: contextualIdentityOnboardingHref(input.saleHref, "registration"),
      emphasis: "secondary",
    };
  }
  if (input.buyerEntities.length === 0) {
    if (input.orgModuleEnabled === false) return null;
    return {
      label: "Set up a buyer profile",
      href: "/onboarding/organisation",
      emphasis: "secondary",
    };
  }
  // Private collectors bid once their identity is checked; only buyer agents register per sale.
  if (!input.buyerEntities.some((entity) => entity.memberRole === "buyer_agent")) return null;
  return { label: "Register to bid", href: "#register-to-bid", emphasis: "secondary" };
}

export function salePrimaryViewerAction(
  input: SalePrimaryViewerActionInput,
): SalePrimaryViewerAction | null {
  if (!saleAllowsWebBidding(input.deliveryMode)) return null;
  if (!saleLifecycleActions(input.status).register) return null;
  if (!input.registrationOffered) return null;
  if (input.hasApprovedRegistration) return null;
  return registerToBidAction(input);
}
