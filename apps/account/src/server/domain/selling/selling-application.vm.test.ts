import type { MyArtistApplication, MyArtistApplicationState } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { buildSellingApplication } from "./selling-application.vm";

const ART = "https://www.thelax.art";

const APPLICATION: MyArtistApplication = {
  id: "0b6a7c1e-2f3d-4a5b-8c9d-0e1f2a3b4c5d",
  reference: "LAX-AP-10001",
  status: "submitted",
  artistName: "Ada Moreno",
  location: "Lisbon",
  website: null,
  socialLinks: [],
  shortBio: null,
  statement: null,
  representation: null,
  exhibitions: null,
  consentToContact: true,
  works: [],
  messageToArtist: null,
  editable: false,
  blockers: [],
  submittedAt: "2026-10-28T10:00:00.000Z",
  decidedAt: null,
  updatedAt: "2026-10-28T10:00:00.000Z",
  version: 4,
};

function state(
  change: Partial<MyArtistApplication>,
  next: MyArtistApplicationState["next"] = "continue",
  availableFrom: string | null = null,
): MyArtistApplicationState {
  return { application: { ...APPLICATION, ...change }, next, availableFrom };
}

describe("Selling: application", () => {
  it("shows a sent application with its journey and a way to see it on lax.art", () => {
    const vm = buildSellingApplication(state({}), ART);
    expect(vm).toMatchObject({
      kind: "application",
      reference: "LAX-AP-10001",
      status: { label: "Submitted", tone: "info" },
      sentOn: "28 October 2026",
      action: {
        label: "See it on lax.art",
        href: `${ART}/for-artists/apply`,
        emphasis: "secondary",
      },
    });
    if (vm.kind !== "application") throw new Error("expected an application");
    expect(vm.journey.map((stage) => [stage.label, stage.current])).toEqual([
      ["Submitted", true],
      ["In review", false],
      ["Decision", false],
    ]);
  });

  it("puts the gallery's question first when it needs an answer", () => {
    const vm = buildSellingApplication(
      state({ status: "more_info_needed", messageToArtist: "Frame sizes?", editable: true }),
      ART,
    );
    expect(vm).toMatchObject({
      status: { label: "More information needed", tone: "warning" },
      message: { label: "The gallery asked", text: "Frame sizes?" },
      action: { label: "Answer the question", emphasis: "primary" },
    });
  });

  it("sends an accepted artist to their artworks", () => {
    expect(buildSellingApplication(state({ status: "accepted" }), ART)).toMatchObject({
      status: { tone: "success" },
      action: { label: "Your artworks", href: "/account/selling/artworks" },
    });
  });

  it("gives a decline its reason and the date to apply again", () => {
    expect(
      buildSellingApplication(
        state(
          { status: "declined", messageToArtist: "The programme is full." },
          "wait",
          "2027-04-28T12:00:00.000Z",
        ),
        ART,
      ),
    ).toMatchObject({
      message: { label: "From the gallery", text: "The programme is full." },
      reapplyOn: "28 April 2027",
      action: null,
    });
  });

  it("offers no link when lax.art's address is not configured", () => {
    expect(
      buildSellingApplication(state({ status: "draft", submittedAt: null }), undefined),
    ).toMatchObject({
      sentOn: null,
      journey: [],
      action: null,
    });
  });
});
