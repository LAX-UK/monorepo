import { SALE_AUTHORITY_NOTE_MAX_LENGTH } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  AUTHORISED_COUNT_MAX,
  AUTHORISED_COUNT_OPTIONS,
  checkGrantAuthority,
  grantButtonLabel,
} from "./sale-authority.vm";

const OWNER = { id: "p1" };
const ARTWORK = { id: "a1" };

describe("the count choices", () => {
  it("offer every whole number from 0 to the most the API takes, in words", () => {
    expect(AUTHORISED_COUNT_OPTIONS).toHaveLength(AUTHORISED_COUNT_MAX + 1);
    expect(AUTHORISED_COUNT_OPTIONS[0]).toMatchObject({ value: "0", label: "0 editions" });
    expect(AUTHORISED_COUNT_OPTIONS[1]?.label).toBe("1 edition");
    expect(AUTHORISED_COUNT_OPTIONS.at(-1)?.value).toBe("10");
  });

  it("explain what zero does", () => {
    expect(AUTHORISED_COUNT_OPTIONS[0]?.description).toBe("Withdraws any authority they have");
  });
});

describe("grantButtonLabel", () => {
  it("repeats what will happen", () => {
    expect(grantButtonLabel(null)).toBe("Grant authority");
    expect(grantButtonLabel(1)).toBe("Authorise 1 edition");
    expect(grantButtonLabel(3)).toBe("Authorise 3 editions");
    expect(grantButtonLabel(0)).toBe("Withdraw authority");
  });
});

describe("checkGrantAuthority", () => {
  it("builds the request from the chosen records", () => {
    expect(
      checkGrantAuthority({
        owner: OWNER,
        artwork: ARTWORK,
        count: "2",
        evidenceNote: "  Signed consignment agreement, 12 Oct  ",
      }),
    ).toEqual({
      ok: true,
      body: {
        artworkId: "a1",
        ownerPartyId: "p1",
        authorisedCount: 2,
        evidenceNote: "Signed consignment agreement, 12 Oct",
      },
    });
  });

  it("accepts 0, which withdraws authority", () => {
    expect(
      checkGrantAuthority({
        owner: OWNER,
        artwork: ARTWORK,
        count: "0",
        evidenceNote: "Withdrawn",
      }),
    ).toMatchObject({ ok: true, body: { authorisedCount: 0 } });
  });

  it("names everything that is missing", () => {
    expect(
      checkGrantAuthority({ owner: null, artwork: null, count: null, evidenceNote: "  " }),
    ).toEqual({
      ok: false,
      errors: {
        owner: "Choose who is being authorised.",
        artwork: "Choose the artwork they may sell.",
        count: "Choose how many editions they may sell.",
        evidenceNote: "Say what the authority is based on, such as a signed agreement.",
      },
    });
  });

  it("rejects a count outside the list", () => {
    for (const count of ["11", "-1", "1.5", "two"]) {
      expect(
        checkGrantAuthority({ owner: OWNER, artwork: ARTWORK, count, evidenceNote: "Note" }),
      ).toMatchObject({ ok: false, errors: { count: expect.any(String) } });
    }
  });

  it("limits the length of the note", () => {
    expect(
      checkGrantAuthority({
        owner: OWNER,
        artwork: ARTWORK,
        count: "1",
        evidenceNote: "n".repeat(SALE_AUTHORITY_NOTE_MAX_LENGTH + 1),
      }),
    ).toEqual({
      ok: false,
      errors: { evidenceNote: `Use ${SALE_AUTHORITY_NOTE_MAX_LENGTH} characters or fewer.` },
    });
  });
});
