import { describe, expect, it } from "vitest";
import {
  FALLBACK_LABEL,
  draftFromRules,
  routingChanged,
  routingRows,
  rulesFromDraft,
  unroutedWarning,
} from "./enquiry-routing-rows";

const nameOf = (id: string) => ({ sofia: "Sofia Okafor", tom: "Tom Reid" })[id] ?? id;

describe("routingRows", () => {
  it("lists the public Sell departments and ends with the fallback", () => {
    const rows = routingRows([]);
    expect(rows.find((row) => row.slug === "paintings")?.label).toBe("Paintings");
    expect(rows.at(-1)).toEqual({ slug: null, label: FALLBACK_LABEL });
  });

  it("keeps a department that is routed but no longer public", () => {
    const rows = routingRows([{ departmentSlug: "works-on-paper", assignedToUserId: "sofia" }]);
    expect(rows.find((row) => row.slug === "works-on-paper")?.label).toBe("Works on paper");
  });
});

describe("a routing draft", () => {
  const rows = routingRows([]);
  const rules = [
    { departmentSlug: "paintings", assignedToUserId: "sofia" },
    { departmentSlug: null, assignedToUserId: "tom" },
  ];

  it("round-trips the saved rules", () => {
    expect(rulesFromDraft(rows, draftFromRules(rules))).toEqual(rules);
  });

  it("leaves out a department with nobody chosen", () => {
    const draft = { ...draftFromRules(rules), paintings: "" };
    expect(rulesFromDraft(rows, draft)).toEqual([
      { departmentSlug: null, assignedToUserId: "tom" },
    ]);
  });

  it("knows when nothing changed", () => {
    expect(routingChanged(rows, draftFromRules(rules), rules)).toBe(false);
    expect(routingChanged(rows, { ...draftFromRules(rules), paintings: "tom" }, rules)).toBe(true);
  });
});

describe("unroutedWarning", () => {
  const rows = routingRows([]).filter((row) => ["paintings", "sculpture", null].includes(row.slug));

  it("is null when every department has a specialist", () => {
    expect(unroutedWarning(rows, { paintings: "sofia", sculpture: "tom" }, nameOf)).toBeNull();
  });

  it("names the department and where its enquiries go instead", () => {
    expect(unroutedWarning(rows, { paintings: "sofia", __fallback: "tom" }, nameOf)).toBe(
      "Sculpture has no specialist. Their enquiries go to Tom Reid.",
    );
  });

  it("says they stay unassigned when there is no fallback either", () => {
    expect(unroutedWarning(rows, { paintings: "sofia" }, nameOf)).toBe(
      "Sculpture has no specialist. Their enquiries stay unassigned for client services to route.",
    );
  });

  it("counts departments when there are many", () => {
    expect(unroutedWarning(routingRows([]), {}, nameOf)).toMatch(
      /^\d+ departments have no specialist/,
    );
  });
});
