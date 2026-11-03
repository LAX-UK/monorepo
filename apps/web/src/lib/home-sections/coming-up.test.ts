import { hangSale } from "@/lib/hang/hang-fixtures";
import { buildComingUp } from "@/lib/home-sections/coming-up";
import { saleListRow } from "@/lib/sale-list-row";
import { describe, expect, it } from "vitest";

const now = new Date("2026-11-01T12:00:00.000Z");
const scheduled = (id: string, over: Parameters<typeof hangSale>[0], lotCount = 6) =>
  saleListRow(hangSale({ id, status: "scheduled", ...over }), [], lotCount);

describe("buildComingUp", () => {
  it("lists the near sale by day and the far sale by month", () => {
    const rows = [
      scheduled("near", {
        title: "Winter evening sale",
        startTime: new Date("2026-11-10T18:00:00.000Z"),
        deliveryMode: "onsite",
        locationCity: "London",
      }),
      scheduled("far", {
        title: "Spring Modern British",
        startTime: new Date("2027-03-09T19:00:00.000Z"),
      }),
    ];
    const list = buildComingUp(rows, ["near", "far"], now);
    expect(list?.rows[0]).toMatchObject({
      dateMain: "10 Nov",
      dateSub: "Tue · 18:00 GMT",
      meta: "In the room, London · 6 lots",
      action: { label: "Preview" },
    });
    expect(list?.rows[1]).toMatchObject({ dateMain: "Mar 2027", dateSub: "Opens Tue 9 Mar 2027" });
  });

  it("offers to consign to a sale that has no lots yet and a deadline ahead", () => {
    const rows = [
      scheduled(
        "s",
        {
          startTime: new Date("2027-03-09T19:00:00.000Z"),
          consignmentDeadline: new Date("2027-01-15T12:00:00.000Z"),
        },
        0,
      ),
    ];
    const row = buildComingUp(rows, ["s"], now)?.rows[0];
    expect(row?.action).toEqual({ href: "/sell", label: "Consign a work" });
    expect(row?.meta).toBe("Online · consignments close 15 Jan 2027");
  });

  it("shows at most four sales, in the order given, and ignores unknown ids", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) =>
      scheduled(id, { startTime: new Date("2026-11-10T18:00:00.000Z") }),
    );
    const list = buildComingUp(rows, ["a", "x", "b", "c", "d", "e"], now);
    expect(list?.rows.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("is hidden with no sale to show", () => {
    expect(buildComingUp([], [], now)).toBeNull();
  });
});
