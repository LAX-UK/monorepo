import { type LocationRef, locationLabel } from "@auction/artwork-register-contracts";
import type { AdminLocationRef } from "@auction/shop-contracts";

/** A location as LAX Admin shows it beside an artwork: its name, marked "(retired)" when so. */
export function presentLocationRef(ref: LocationRef): AdminLocationRef {
  return { id: ref.id, name: ref.name, status: ref.status, label: locationLabel(ref) };
}
