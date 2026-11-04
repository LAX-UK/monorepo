import { SHOP_STAFF_CAPABILITIES } from "@auction/shop-domain";
import { buildAdminNavGroups, flattenAdminNav } from "../../src/server/domain/admin-nav.vm.js";
import type { AdminSessionFeatures } from "./feature-gate.js";

/** Everything switched on: the widest nav LAX Admin can show. */
export const ALL_FEATURES: AdminSessionFeatures = {
  payouts: true,
  thirdPartySales: true,
  originalSales: true,
  merchandise: true,
};

/** The artwork editor's path needs a real artwork, looked up once the session is signed in. */
export const ARTWORK_EDITOR_PATH = "/artworks/:artworkId";

export type StaffPage = {
  path: string;
  /** Stable file-name-safe name: the screenshot name and the test title. */
  slug: string;
  label: string;
};

function slugOf(path: string): string {
  return path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

/**
 * Every page in the staff nav, read from the nav itself so a new page is covered the day it is
 * added to it, plus the artwork screens that hang off Artworks (new, import from the catalogue,
 * and the editor).
 */
export function administratorStaffPages(): StaffPage[] {
  const nav = flattenAdminNav(
    buildAdminNavGroups({ capabilities: SHOP_STAFF_CAPABILITIES, features: ALL_FEATURES }),
  );
  const extra: StaffPage[] = [
    { path: "/artworks/new", label: "New artwork", slug: "artworks-new" },
    { path: "/artworks/import", label: "Import by catalogue key", slug: "artworks-import" },
    { path: ARTWORK_EDITOR_PATH, label: "Artwork editor", slug: "artworks-editor" },
  ];
  return [...nav.map(({ href, label }) => ({ path: href, label, slug: slugOf(href) })), ...extra];
}
