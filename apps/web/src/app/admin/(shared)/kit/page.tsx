import { LaxComponentSheet } from "@/components/admin/kit/lax-component-sheet";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "LAX system components",
  "Every shared element in every state, at the staff and client densities.",
);

/**
 * The reviewable sheet of the LAX system primitives (`@auction/ui/lax`): each element in every
 * state, at both densities, in the real staff shell. Every staff member can open it.
 */
export default function AdminKitPage() {
  return <LaxComponentSheet />;
}
