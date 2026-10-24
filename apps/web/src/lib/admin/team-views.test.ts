import { sameViewQuery } from "@auction/staff-ui";
import { describe, expect, it } from "vitest";
import { lotsListHref, lotsTeamViews } from "./lots/lots-staff-list.vm";
import { clientsListHref, clientsTeamViews } from "./people/clients-staff-list.vm";

const searchOf = (query: string) => Object.fromEntries(new URLSearchParams(query));

describe("Bid admin team views", () => {
  it("offers lots views built from the list's own filters", () => {
    expect(lotsTeamViews().map((view) => [view.label, view.query])).toEqual([
      ["Drafts missing photos", "status=draft&needsPhotos=1"],
      ["Live, ending soonest", "status=active&sort=endingAsc"],
      ["Ended, highest hammer first", "status=ended&sort=hammerDesc"],
    ]);
  });

  it("offers clients views built from the list's own filters", () => {
    expect(clientsTeamViews().map((view) => [view.label, view.query])).toEqual([
      ["Identity submitted", "kycStatus=pending"],
      ["Email not verified", "emailVerified=0"],
      ["Newest sign-ups", "sort=created_desc"],
    ]);
  });

  it("links each view to the list, and the list recognises that URL as the view", () => {
    for (const view of lotsTeamViews()) {
      expect(view.href).toBe(`/admin/lots?${view.query}`);
      const current = lotsListHref(searchOf(view.query), {}).split("?")[1] ?? "";
      expect(sameViewQuery(current, view.query)).toBe(true);
    }
    for (const view of clientsTeamViews()) {
      expect(view.href).toBe(`/admin/clients?${view.query}`);
      const current = clientsListHref(searchOf(view.query), {}).split("?")[1] ?? "";
      expect(sameViewQuery(current, view.query)).toBe(true);
    }
  });

  it("gives every view its own id", () => {
    for (const views of [lotsTeamViews(), clientsTeamViews()]) {
      expect(new Set(views.map((view) => view.id)).size).toBe(views.length);
    }
  });
});
