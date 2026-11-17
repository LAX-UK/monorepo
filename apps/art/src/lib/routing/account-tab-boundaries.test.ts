import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ArtAccountNavHref,
  buildArtAccountTabs,
  buildArtFavouritesTabs,
} from "@/lib/account/account-nav.vm";
import { describe, expect, it } from "vitest";

/**
 * Switching between sibling tab routes must mount a new loading boundary, never re-render inside
 * one that is already on screen. Next keys a `loading.tsx` boundary by the segment directly below
 * it, so the boundary has to sit in the tabs' common parent folder. When it sat higher up (Saves and
 * Follows under `account/loading.tsx`, keyed by the unchanged `favourites` segment), a tab tapped
 * while the page was still hydrating re-suspended inside the visible boundary. The React build
 * bundled with Next 15.5 then dropped the retry, so the tap did nothing and the router stayed
 * stuck on the old tab. See ArtArtworksCataloguePage for the same failure on query navigation.
 */
describe("account tab routes", () => {
  const appDir = fileURLToPath(new URL("../../app", import.meta.url));

  function pageDir(href: ArtAccountNavHref): string {
    const dir = join(appDir, ...href.split("/").filter(Boolean));
    expect(existsSync(join(dir, "page.tsx")), href).toBe(true);
    return dir;
  }

  function commonParent(dirs: string[]): string {
    const parts = dirs.map((dir) => dir.split(sep));
    const shared: string[] = [];
    for (let i = 0; parts.every((p) => p[i] !== undefined && p[i] === parts[0]?.[i]); i++) {
      shared.push(parts[0]?.[i] ?? "");
    }
    return shared.join(sep);
  }

  it.each([
    ["account", buildArtAccountTabs("/account")],
    ["favourites", buildArtFavouritesTabs("/account/favourites")],
  ])("%s tabs share a loading boundary keyed by the segment that changes", (_name, tabs) => {
    const parent = commonParent(tabs.map((tab) => pageDir(tab.href)));
    expect(existsSync(join(parent, "loading.tsx")), relative(appDir, parent)).toBe(true);
  });
});
