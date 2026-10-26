import type { EditorialEntityKind } from "@/lib/editorial-entity-forms";
import { editorialPublicPath } from "./editorial-list.vm";

/** The site address as staff read it: "lax.art", from the configured origin. */
export function publicHost(artPublicUrl: string | null | undefined): string {
  const host = artPublicUrl
    ?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return host || "lax.art";
}

/** "lax.art/exhibitions/summer-show", or null for an item with no fixed address (pages). */
export function editorialPublicAddress(
  kind: EditorialEntityKind,
  slug: string,
  artPublicUrl: string | null | undefined,
): string | null {
  const path = editorialPublicPath(kind, slug);
  return path ? `${publicHost(artPublicUrl)}${path}` : null;
}

export type PublicationDialogCopy = {
  title: string;
  description: string;
  confirmLabel: string;
};

/**
 * What a publish or unpublish confirmation says: the action, the item and what changes on
 * lax.art. `noun` is lower case ("exhibition"); `address` is the item's page when it has one.
 */
export function publicationDialogCopy({
  publish,
  noun,
  name,
  address,
}: {
  publish: boolean;
  noun: string;
  name: string;
  address: string | null;
}): PublicationDialogCopy {
  const where = address ? `The page at ${address}` : `The ${noun}`;
  return publish
    ? {
        title: `Publish “${name}”?`,
        description: address
          ? `${where} goes live on lax.art straight away. You can unpublish it later.`
          : `The ${noun} goes live on lax.art straight away. You can unpublish it later.`,
        confirmLabel: `Publish ${noun}`,
      }
    : {
        title: `Unpublish “${name}”?`,
        description: `${where} stops showing on lax.art. You can publish it again later.`,
        confirmLabel: `Unpublish ${noun}`,
      };
}
