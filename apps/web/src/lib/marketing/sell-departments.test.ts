import { DEPARTMENTS } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  SELL_DEPARTMENT_GROUPS,
  type SellDepartment,
  departmentIntakeHref,
  visibleSellDepartmentGroups,
} from "./sell-departments";

function departmentById(id: string): SellDepartment {
  const department = SELL_DEPARTMENT_GROUPS.flatMap((g) => g.departments).find((d) => d.id === id);
  if (!department) throw new Error(`missing department: ${id}`);
  return department;
}

describe("departmentIntakeHref", () => {
  it("routes wizard departments to the submission wizard with categorySlug", () => {
    const watches = departmentById("watches-clocks");
    expect(departmentIntakeHref(watches)).toBe("/selling/new?categorySlug=watches-clocks");
  });

  it("routes estate collections to the submission wizard", () => {
    const estate = departmentById("estate");
    expect(departmentIntakeHref(estate)).toBe("/selling/new");
  });

  it("routes prints through the wizard with category preselect", () => {
    const prints = departmentById("fine-prints");
    expect(departmentIntakeHref(prints)).toBe("/selling/new?categorySlug=fine-prints");
  });
});

describe("the department list", () => {
  it("is the domain's twelve, in the same order and names, on the sell page", () => {
    const sell = visibleSellDepartmentGroups()
      .flatMap((g) => g.departments)
      .filter((d) => d.slug)
      .map((d) => ({ slug: d.slug, label: d.label }));
    const domain = DEPARTMENTS.map((d) => ({ slug: d.slug, label: d.label }));
    // The sell page groups by kind, so compare as sets of slug and name.
    expect(new Set(sell.map((d) => `${d.slug}|${d.label}`))).toEqual(
      new Set(domain.map((d) => `${d.slug}|${d.label}`)),
    );
    expect(sell).toHaveLength(12);
  });
});

describe("visibleSellDepartmentGroups", () => {
  it("excludes hidden jewellery and handbags departments", () => {
    const visibleIds = visibleSellDepartmentGroups().flatMap((g) => g.departments.map((d) => d.id));
    expect(visibleIds).not.toContain("jewellery");
    expect(visibleIds).not.toContain("handbags-accessories");
    expect(visibleIds).toContain("watches-clocks");
  });
});
