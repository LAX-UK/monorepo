import { hangSale } from "@/lib/hang/hang-fixtures";
import { buildComingUp, comingUpLayout } from "@/lib/home-sections/coming-up";
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

  it("shows at most three sales, in the order given, and ignores unknown ids", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) =>
      scheduled(id, { startTime: new Date("2026-11-10T18:00:00.000Z") }),
    );
    const list = buildComingUp(rows, ["a", "x", "b", "c", "d", "e"], now);
    expect(list?.rows.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("lays one sale out as a feature card and two or three as a row", () => {
    expect(comingUpLayout(1)).toBe("feature");
    expect(comingUpLayout(2)).toBe("row");
    expect(comingUpLayout(3)).toBe("row");
    const rows = ["a", "b"].map((id) =>
      scheduled(id, { startTime: new Date("2026-11-10T18:00:00.000Z") }),
    );
    expect(buildComingUp(rows, ["a"], now)?.layout).toBe("feature");
    expect(buildComingUp(rows, ["a", "b"], now)?.layout).toBe("row");
  });

  it("counts down in the final hour and words the time left within a week", () => {
    const rows = [scheduled("soon", { startTime: new Date("2026-11-01T12:30:00.000Z") })];
    const row = buildComingUp(rows, ["soon"], now)?.rows[0];
    expect(row?.time?.tick?.template).toContain("in {time}");
    const week = [scheduled("w", { startTime: new Date("2026-11-04T12:00:00.000Z") })];
    const near = buildComingUp(week, ["w"], now)?.rows[0];
    expect(near?.time?.text).toContain("in 3 days");
    expect(near?.time?.tick).toBeUndefined();
  });

  it("carries the staff-chosen cover and its focal point, or none", () => {
    const withCover = saleListRow(
      hangSale({
        id: "c",
        status: "scheduled",
        startTime: new Date("2026-11-10T18:00:00.000Z"),
        coverSlotAssets: {
          default: {
            src: "https://cdn.test/c.jpg",
            width: 3000,
            height: 2000,
            focal: { x: 0.3, y: 0.6 },
            zoom: 1,
            alt: "A harbour",
            side: "left",
            analysisStatus: "ready",
          },
        } as never,
      }),
      [],
      6,
    );
    const list = buildComingUp(
      [withCover, scheduled("n", { startTime: new Date("2026-11-11T18:00:00.000Z") })],
      ["c", "n"],
      now,
    );
    expect(list?.rows[0]?.image).toEqual({
      src: "https://cdn.test/c.jpg",
      alt: "A harbour",
      focal: { x: 0.3, y: 0.6 },
    });
    expect(list?.rows[1]?.image).toBeNull();
  });

  it("is hidden with no sale to show", () => {
    expect(buildComingUp([], [], now)).toBeNull();
  });
});
