import type { AdminSaleRegistrationRow } from "@/lib/data/http/admin-sale-registrations.types";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import { telephoneBookingStatusLabel } from "@/lib/telephone/telephone-booking-types";
import type { EntityDocument } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";
import { resolveDotStatusPresentation } from "./resolver";

export type DotStatusPresentation = {
  label: string;
  tone: DotStatusPillTone;
};

export function registrationDotStatus(
  status: AdminSaleRegistrationRow["status"],
): DotStatusPresentation {
  return resolveDotStatusPresentation("registration", status);
}

export function documentVisibilityDotStatus(doc: EntityDocument): DotStatusPresentation {
  const isPublic = doc.kind === "terms" || doc.kind === "catalog";
  return {
    label: isPublic ? "Public" : "Staff only",
    tone: isPublic ? "info" : "pending",
  };
}

export function saleMediaPublishedDotStatus(isPublished: boolean): DotStatusPresentation {
  return {
    label: isPublished ? "Published" : "Draft",
    tone: isPublished ? "success" : "draft",
  };
}

export function telephoneBookingDotStatus(
  status: AdminTelephoneBookingRow["status"],
): DotStatusPresentation {
  if (status === "requested") return { label: telephoneBookingStatusLabel(status), tone: "draft" };
  if (status === "confirmed" || status === "in_progress") {
    return { label: telephoneBookingStatusLabel(status), tone: "live" };
  }
  if (status === "completed") {
    return { label: telephoneBookingStatusLabel(status), tone: "success" };
  }
  return { label: telephoneBookingStatusLabel(status), tone: "critical" };
}

export function pressMentionDotStatus(label: string): DotStatusPresentation {
  return { label, tone: "info" };
}
