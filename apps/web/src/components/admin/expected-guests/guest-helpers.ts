import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import type { OnsiteEventSegmentOption } from "@auction/types";

export function guestDisplayName(guest: AdminExpectedGuestRow): string {
  return guest.name ?? guest.email;
}

export function segmentLabel(options: OnsiteEventSegmentOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");
}

export function accountBlockers(guest: AdminExpectedGuestRow): string[] {
  const blockers: string[] = [];
  if (guest.suspended) blockers.push("Suspended");
  if (!guest.kycApproved) blockers.push("KYC");
  if (!guest.emailVerified) blockers.push("Email");
  return blockers;
}
