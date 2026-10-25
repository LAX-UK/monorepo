import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import type { StatusPresentation } from "@auction/staff-ui";
import type { OnsiteEventSegmentOption } from "@auction/types";

export function guestDisplayName(guest: AdminExpectedGuestRow): string {
  return guest.name ?? guest.email;
}

export function segmentLabel(options: OnsiteEventSegmentOption[], value: string): string {
  const label = options.find((option) => option.value === value)?.label;
  if (label) return label;
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** What stops express check-in on the guest's account, in words. */
export function accountBlockers(guest: AdminExpectedGuestRow): string[] {
  const blockers: string[] = [];
  if (guest.suspended) blockers.push("Account suspended");
  if (!guest.kycApproved) blockers.push("Identity check incomplete");
  if (!guest.emailVerified) blockers.push("Email not verified");
  return blockers;
}

export function hasNoBuyingEntity(guest: AdminExpectedGuestRow): boolean {
  return guest.eligibleEntities.length === 0;
}

/** Whether the guest can be checked in from the list, or needs something resolved first. */
export function guestReadiness(guest: AdminExpectedGuestRow): StatusPresentation {
  const blockers = accountBlockers(guest);
  const [first] = blockers;
  if (first) {
    return {
      label: blockers.length > 1 ? `${first} and ${blockers.length - 1} more` : first,
      tone: "danger",
    };
  }
  if (hasNoBuyingEntity(guest)) return { label: "No buying entity", tone: "warning" };
  return { label: "Ready", tone: "success" };
}

/** Where the guest stands at this sale: not arrived, present, or holding a paddle. */
export function guestSaleStatus(guest: AdminExpectedGuestRow): StatusPresentation {
  const registration = guest.saleRegistration;
  if (registration?.paddleNumber != null) {
    return { label: `Paddle ${registration.paddleNumber}`, tone: "success" };
  }
  if (registration?.checkedInAt) return { label: "Present", tone: "success" };
  return { label: "Not arrived", tone: "neutral" };
}

/** The entity a guest is checked in under unless staff choose another: their own, else the first. */
export function defaultGuestEntityId(guest: AdminExpectedGuestRow): string {
  const personal = guest.eligibleEntities.find((entity) => entity.kind === "individual");
  return personal?.id ?? guest.eligibleEntities[0]?.id ?? "";
}
