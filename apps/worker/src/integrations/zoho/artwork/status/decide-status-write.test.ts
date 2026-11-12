import { WHERE_IT_IS_KEYS, zohoStatusForPlace } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { decideStatusWrite } from "./decide-status-write.js";

/** Every Status LAX can want, one per place, and the values staff might hold in Zoho. */
const WANTED = [...new Set(WHERE_IT_IS_KEYS.map(zohoStatusForPlace))];
const STAFF_OR_UNKNOWN = ["Sold", "Reserved", "Draft", "On Loan", "available"];
const KNOWN = ["Available", "Reserved", "In Auction", "Sold", "Withdrawn"];

describe("decideStatusWrite: every wanted Status against every Zoho Status", () => {
  it.each(WANTED)("%s: Zoho already shows it, nothing to send", (wanted) => {
    for (const lastWritten of [null, ...KNOWN]) {
      expect(decideStatusWrite({ wanted, zohoStatus: wanted, lastWritten })).toEqual({
        kind: "in_sync",
      });
    }
  });

  it.each(WANTED)("%s: Zoho shows nothing, LAX writes", (wanted) => {
    expect(decideStatusWrite({ wanted, zohoStatus: null, lastWritten: null })).toEqual({
      kind: "write",
    });
  });

  it.each(WANTED)("%s: Zoho shows Available, LAX writes", (wanted) => {
    const decision = decideStatusWrite({ wanted, zohoStatus: "Available", lastWritten: null });
    expect(decision).toEqual(wanted === "Available" ? { kind: "in_sync" } : { kind: "write" });
  });

  it.each(WANTED)("%s: Zoho shows what LAX last wrote, LAX writes", (wanted) => {
    for (const written of KNOWN.filter((status) => status !== wanted)) {
      expect(decideStatusWrite({ wanted, zohoStatus: written, lastWritten: written })).toEqual({
        kind: "write",
      });
    }
  });

  it.each(WANTED)(
    "%s: a Sold, Reserved or unknown value LAX did not write is staff's, so a conflict",
    (wanted) => {
      for (const zohoStatus of STAFF_OR_UNKNOWN.filter((status) => status !== wanted)) {
        // LAX last wrote something else, or nothing: the value is not LAX's.
        for (const lastWritten of [null, "Withdrawn", "In Auction"]) {
          expect(decideStatusWrite({ wanted, zohoStatus, lastWritten })).toEqual({
            kind: "conflict",
            zohoStatus,
          });
        }
      }
    },
  );

  it.each(WANTED)(
    "%s: Withdrawn and In Auction set by anyone but LAX are also left alone",
    (wanted) => {
      for (const zohoStatus of ["Withdrawn", "In Auction"].filter((status) => status !== wanted)) {
        expect(decideStatusWrite({ wanted, zohoStatus, lastWritten: "Reserved" })).toEqual({
          kind: "conflict",
          zohoStatus,
        });
      }
    },
  );
});

describe("decideStatusWrite: the cases that motivated it", () => {
  it("never writes Withdrawn over a Reserved a gallery hold set by hand", () => {
    expect(
      decideStatusWrite({ wanted: "Withdrawn", zohoStatus: "Reserved", lastWritten: "Available" }),
    ).toEqual({ kind: "conflict", zohoStatus: "Reserved" });
  });

  it("never writes over a Sold set by hand", () => {
    expect(
      decideStatusWrite({ wanted: "Available", zohoStatus: "Sold", lastWritten: "In Auction" }),
    ).toEqual({ kind: "conflict", zohoStatus: "Sold" });
  });

  it("writes over a Reserved that LAX itself wrote for a private sale", () => {
    expect(
      decideStatusWrite({ wanted: "Withdrawn", zohoStatus: "Reserved", lastWritten: "Reserved" }),
    ).toEqual({ kind: "write" });
  });

  it("returns a withdrawn artwork to Available once the window has passed", () => {
    expect(
      decideStatusWrite({ wanted: "Available", zohoStatus: "Withdrawn", lastWritten: "Withdrawn" }),
    ).toEqual({ kind: "write" });
  });
});
