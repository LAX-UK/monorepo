import { describe, expect, it } from "vitest";
import { buildWhileYouWait } from "./sales-calendar-while-you-wait";
import { calendarSaleRow } from "./sales-calendar.fixtures";

const NOW = new Date("2026-11-01T12:00:00.000Z");

const finalResult = {
  state: "final",
  lotCount: 24,
  soldCount: 18,
  currency: "GBP",
  totalWithPremium: "186400.00",
  endedAt: "2026-10-15T17:00:00.000Z",
};

describe("buildWhileYouWait", () => {
  it("offers the last result with its figures once they are final", () => {
    const links = buildWhileYouWait(
      { results: [calendarSaleRow("r1", "ended", { resultsSummary: finalResult })] },
      NOW,
    );
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      id: "lastResult",
      title: "Sale r1",
      detail: "Ended 15 Oct 2026 · 18 of 24 sold · £186,400.00",
    });
  });

  it("gives no figures while results are still finalising", () => {
    const links = buildWhileYouWait(
      {
        results: [
          calendarSaleRow("r1", "ended", {
            resultsSummary: { state: "finalising", pendingLotCount: 3 },
          }),
        ],
      },
      NOW,
    );
    expect(links[0]?.detail).toBe("Ended 15 Oct 2026");
  });

  it("offers consignments when a sale has a deadline still ahead", () => {
    const links = buildWhileYouWait(
      {
        upcoming: [
          calendarSaleRow("u1", "scheduled", { consignmentDeadline: "2027-01-15T12:00:00.000Z" }),
          calendarSaleRow("u2", "scheduled", { consignmentDeadline: "2026-12-05T12:00:00.000Z" }),
        ],
      },
      NOW,
    );
    expect(links).toEqual([
      {
        id: "consignments",
        title: "Consignments are open",
        detail: "Close 5 Dec 2026",
        href: "/sell",
      },
    ]);
  });

  it("ignores a deadline that has passed", () => {
    const links = buildWhileYouWait(
      {
        upcoming: [
          calendarSaleRow("u1", "scheduled", { consignmentDeadline: "2026-10-01T12:00:00.000Z" }),
        ],
      },
      NOW,
    );
    expect(links).toEqual([]);
  });

  it("lists nothing when there is nothing real to point at", () => {
    expect(buildWhileYouWait({ results: [], upcoming: [] }, NOW)).toEqual([]);
    expect(buildWhileYouWait({}, NOW)).toEqual([]);
  });

  it("puts the last result before consignments", () => {
    const links = buildWhileYouWait(
      {
        results: [calendarSaleRow("r1", "ended")],
        upcoming: [
          calendarSaleRow("u1", "scheduled", { consignmentDeadline: "2027-01-15T12:00:00.000Z" }),
        ],
      },
      NOW,
    );
    expect(links.map((l) => l.id)).toEqual(["lastResult", "consignments"]);
  });
});
